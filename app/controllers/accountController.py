"""Routes for /api/v1/accounts (Postgres-backed via models.database).

Access rules:
  - open an account : a customer opening their OWN account, or staff
                       opening one on a customer's behalf
  - get one account  : the owning customer, or staff
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import UserORM, get_db
from models.schemas import AccountCreate
from security.dependencies import ensure_self_or_staff, get_current_user
from services import accountService

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("", status_code=201)
def open_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Open a new account and persist it to Postgres.

    A customer can only open an account for themselves (payload.customer_id
    must match their own customer_id); staff can open one for anyone.
    """
    ensure_self_or_staff(current_user, payload.customer_id)
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
def get_account(
    account_number: str,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Retrieve one account by account number. Owning customer or staff only.

    Note the ordering here: we fetch the account BEFORE checking ownership,
    since (unlike the customer/{customer_id} routes) the URL only gives us
    an account_number -- we don't know which customer owns it until we look
    the account up.
    """
    account = accountService.get_account(db, account_number)
    ensure_self_or_staff(current_user, account.customer_id)
    return account.to_dict()
