"""Business logic for transactions -- reads and writes Postgres directly.

Deliberately simple for now: one SQLAlchemy session per call, no repository
layer indirection. Accounts referenced here are rows in the new `accounts`
table (models/database.py), separate from the in-memory accounts the
customer/account endpoints still use -- see models/database.py's docstring.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select

from models.database import Account as AccountORM, SessionLocal, Transaction as TransactionORM
from models.domain import TransactionType


def _serialize(transaction: TransactionORM) -> dict:
    """Shape a Transaction row the same way the rest of the API returns transactions."""
    return {
        "transaction_id": transaction.id,
        "from_account_id": transaction.from_account_id,
        "to_account_id": transaction.to_account_id,
        "amount": transaction.amount,
        "description": transaction.description,
        "type": transaction.type,
        "timestamp": transaction.timestamp,
    }


def _debit_floor(account: AccountORM) -> float:
    """Lowest balance allowed after a debit.

    Accounts with an ``overdraft_limit`` may go negative down to
    ``-overdraft_limit``. Otherwise the balance cannot go below zero.
    """
    if account.overdraft_limit is not None:
        return -float(account.overdraft_limit)
    return 0.0


def _ensure_can_debit(account: AccountORM, amount: float) -> None:
    """Raise 400 if debiting ``amount`` would breach overdraft protection."""
    if account.balance - amount < _debit_floor(account):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient funds.",
        )


def create_transaction(txn_data: dict) -> dict:
    """Create a transaction and apply its real balance effect, dispatched by
    transaction_type. Each type needs a different subset of accounts -- you
    don't pass both from_account and to_account for everything:

      - Deposit:    to_account only    -> credits that account.
      - Withdrawal: from_account only  -> debits that account.
      - Transfer:   both               -> delegates to process_transfer.

    Expects the shape of TransactionCreate: from_account, to_account,
    amount, transaction_type.
    """
    # Validate the type string first -- everything else below branches on it.
    try:
        tx_type = TransactionType(txn_data.get("transaction_type"))
    except ValueError:
        valid = [t.value for t in TransactionType]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"transaction_type must be one of {valid}.",
        )

    amount = txn_data.get("amount")
    if amount is None or amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="amount must be greater than 0.")

    # Accept both the REST-ish `from_account`/`to_account` keys and the
    # `_id`-suffixed ones so this works whether the caller sent a
    # TransactionCreate payload or a hand-built dict (e.g. from a test).
    from_account_id = txn_data.get("from_account") or txn_data.get("from_account_id")
    to_account_id = txn_data.get("to_account") or txn_data.get("to_account_id")
    description = txn_data.get("description")

    # Dispatch on type, checking that only the accounts that type needs were
    # actually supplied (see the docstring's table above).
    if tx_type is TransactionType.TRANSFER:
        if not from_account_id or not to_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A transfer requires both from_account and to_account.",
            )
        return process_transfer(from_account_id, to_account_id, amount, description)

    if tx_type is TransactionType.DEPOSIT:
        if not to_account_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A deposit requires to_account.")
        if from_account_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A deposit should not include from_account.")
        return _apply_single_account_transaction(to_account_id, amount, tx_type, description, credit=True)

    # WITHDRAWAL
    if not from_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A withdrawal requires from_account.")
    if to_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A withdrawal should not include to_account.")
    return _apply_single_account_transaction(from_account_id, amount, tx_type, description, credit=False)


def _apply_single_account_transaction(
    account_id: str, amount: float, tx_type: TransactionType, description: Optional[str], credit: bool
) -> dict:
    """Deposit into (credit=True) or withdraw from (credit=False) one account."""
    with SessionLocal() as session:
        account = session.get(AccountORM, account_id)
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account '{account_id}' not found.")
        if not account.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Account '{account_id}' is inactive.")

        if credit:
            # Deposits always succeed once the account itself checks out --
            # there's no upper bound on a balance.
            account.balance += amount
        else:
            # Withdrawals must respect overdraft protection; raises before
            # the balance is touched if the debit would breach the floor.
            _ensure_can_debit(account, amount)
            account.balance -= amount

        transaction = TransactionORM(
            id=str(uuid.uuid4()),
            from_account_id=None if credit else account_id,
            to_account_id=account_id if credit else None,
            amount=amount,
            description=description,
            type=tx_type.value,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(transaction)
        session.commit()
        session.refresh(transaction)
        return _serialize(transaction)


def get_transactions(start_date: Optional[str] = None, transaction_type: Optional[str] = None) -> List[dict]:
    """Return transactions, optionally filtered by start date (YYYY-MM-DD) or type."""
    with SessionLocal() as session:
        # Start unfiltered and narrow the query with each optional param
        # supplied -- both filters are independent and can combine.
        stmt = select(TransactionORM)

        if transaction_type:
            stmt = stmt.where(TransactionORM.type == transaction_type)

        if start_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date; use YYYY-MM-DD.")
            stmt = stmt.where(TransactionORM.timestamp >= start)

        transactions = session.scalars(stmt).all()
        return [_serialize(t) for t in transactions]


def get_transaction(transaction_id: str) -> dict:
    """Fetch a single transaction by ID; raises 404 if not found."""
    with SessionLocal() as session:
        transaction = session.get(TransactionORM, transaction_id)
        if transaction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction '{transaction_id}' not found.")
        return _serialize(transaction)


def process_transfer(
    from_account_id: str, to_account_id: str, amount: float, description: Optional[str] = None
) -> dict:
    """Move money between two accounts and record the transaction."""
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer amount must be greater than 0.")
    if from_account_id == to_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot transfer money to the same account.")

    with SessionLocal() as session:
        from_account = session.get(AccountORM, from_account_id)
        if from_account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account '{from_account_id}' not found.")

        to_account = session.get(AccountORM, to_account_id)
        if to_account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account '{to_account_id}' not found.")

        if not from_account.is_active or not to_account.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot transfer using an inactive account.")

        _ensure_can_debit(from_account, amount)

        # Both balance updates and the transaction insert commit together --
        # if anything above raised, nothing here has been written yet.
        from_account.balance -= amount
        to_account.balance += amount

        transaction = TransactionORM(
            id=str(uuid.uuid4()),
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount=amount,
            description=description,
            type=TransactionType.TRANSFER.value,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(transaction)
        session.commit()
        session.refresh(transaction)
        return _serialize(transaction)