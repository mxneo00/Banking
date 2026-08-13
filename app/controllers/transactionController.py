""" Routes for /api/v1/transactions -- with RBAC.

Access rules (see security/dependencies.py for the mechanics):
  - POST /transactions          (deposit/withdraw) : teller or admin only.
    Customers don't self-serve deposits/withdrawals over this API -- a
    teller acts on their behalf, per "TELLER: deposit/withdraw on behalf
    of customers."
  - POST /transactions/transfer                     : the owning customer
    (their own from_account only), or any staff member transferring on
    anyone's behalf. Destination may be any account -- customers are
    allowed to send *to* accounts they do not own.
  - GET  /transactions, /transactions/{id}           : a customer sees only
    transactions touching their own account(s); staff sees everything.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.database import Account as AccountORM, UserORM, UserRole, get_db
from models.schemas import TransactionCreate, TransferRequest
from security.dependencies import ensure_self_or_staff, get_current_user, is_staff, require_roles
from services import transactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

# Built once at import time, reused by the route below -- see
# security/dependencies.py's require_roles() docstring for how this works.
_TELLER_OR_ADMIN = require_roles(UserRole.TELLER, UserRole.ADMIN)


def _get_account_or_404(db: Session, account_number: str) -> AccountORM:
    """Just enough of a lookup to check ownership before handing off to
    transactionService, which does its own separate lookup for the actual
    business logic (balance checks, etc.). Two lookups of the same row is a
    little redundant, but keeps the RBAC check visibly in the controller
    instead of buried in service internals -- worth the tradeoff here."""
    account = db.get(AccountORM, account_number)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account '{account_number}' not found.")
    return account


def _own_account_numbers(db: Session, current_user: UserORM) -> set:
    """Every account number belonging to the current customer -- used to
    filter the ledger down to "my transactions only" for non-staff callers."""
    rows = db.query(AccountORM.account_number).filter(AccountORM.customer_id == current_user.customer_id).all()
    return {number for (number,) in rows}


# POST /api/v1/transactions - deposit/withdraw, teller/admin only.
@router.post("", status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, _staff: UserORM = Depends(_TELLER_OR_ADMIN)):
    """Record a deposit or withdrawal on a customer's behalf. Teller/admin only."""
    return transactionService.create_transaction(payload.model_dump())

# POST /api/v1/transactions/transfer - a customer transferring their OWN
# money, or staff transferring on anyone's behalf.
@router.post("/transfer", status_code=status.HTTP_201_CREATED)
def transfer_money(
    payload: TransferRequest,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Process a money transfer between two accounts and return the saved record.

    Authorization is on the source only: a customer must own from_account_id.
    to_account_id is not ownership-checked so customers can pay other people.
    """
    source_account = _get_account_or_404(db, payload.from_account_id)
    ensure_self_or_staff(current_user, source_account.customer_id)
    return transactionService.process_transfer(
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        description=payload.description,
    )

# GET /api/v1/transactions - a customer sees only their own transactions;
# staff sees everything.
@router.get("")
def get_transactions(
    start_date: Optional[str] = None,
    transaction_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Return all transactions, optionally filtered by start date or type."""
    transactions = transactionService.get_transactions(start_date=start_date, transaction_type=transaction_type)
    if is_staff(current_user):
        return transactions

    # Small in-Python filter rather than a DB-level join, since
    # transactionService.get_transactions() doesn't take a customer filter
    # today -- fine at this scale; revisit if the ledger grows huge.
    own_accounts = _own_account_numbers(db, current_user)
    return [
        t for t in transactions
        if t["from_account_id"] in own_accounts or t["to_account_id"] in own_accounts
    ]

# GET /api/v1/transactions/{transaction_id} - same ownership rule as above.
@router.get("/{transaction_id}")
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Fetch a single transaction by ID; raises 404 if not found, 403 if it's not yours and you're not staff."""
    transaction = transactionService.get_transaction(transaction_id)
    if not is_staff(current_user):
        own_accounts = _own_account_numbers(db, current_user)
        if transaction["from_account_id"] not in own_accounts and transaction["to_account_id"] not in own_accounts:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your own transactions.")
    return transaction

# Note: PUT (update) and DELETE (deactivate) are intentionally omitted for
# transactions to maintain immutable ledger constraints.
