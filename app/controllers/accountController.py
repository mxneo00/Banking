"""Routes for /api/v1/accounts (Postgres-backed via models.database)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import AccountCreate
from services import accountService

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("", status_code=201)
def open_account(payload: AccountCreate, db: Session = Depends(get_db)):
    """Open a new account and persist it to Postgres."""
    account = accountService.open_account(
        db,
        customer_id=payload.customer_id,
        account_type=payload.account_type,
        opening_balance=payload.opening_balance,
        minimum_balance=payload.minimum_balance,
        overdraft_limit=payload.overdraft_limit,
    )
    db.commit()
    db.refresh(account)
    return account.to_dict()


@router.get("/{account_number}")
def get_account(account_number: str, db: Session = Depends(get_db)):
    """Retrieve one account by account number."""
    account = accountService.get_account(db, account_number)
    return account.to_dict()
