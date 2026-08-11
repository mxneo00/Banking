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


def create_transaction(txn_data: dict) -> dict:
    """Record a transaction directly -- no balance movement, just a ledger
    row. Useful for deposit/withdrawal-style entries that don't need
    process_transfer's two-account dance. Expects the shape of
    TransactionCreate: from_account, to_account, amount, transaction_type.
    """
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

    from_account_id = txn_data.get("from_account") or txn_data.get("from_account_id")
    to_account_id = txn_data.get("to_account") or txn_data.get("to_account_id")

    with SessionLocal() as session:
        # `to_account_id`/`from_account_id` are foreign keys onto accounts,
        # so an unknown account would otherwise surface as a raw, unhandled
        # IntegrityError (-> 500) instead of a clean 404. Check up front.
        for account_id in (from_account_id, to_account_id):
            if account_id and session.get(AccountORM, account_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account '{account_id}' not found.")

        transaction = TransactionORM(
            id=str(uuid.uuid4()),
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount=amount,
            description=txn_data.get("description"),
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

        if from_account.balance < amount:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient funds in the origin account.")

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