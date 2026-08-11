"""Routes for /api/v1/accounts."""

from fastapi import APIRouter

from models.schemas import AccountCreate  # pyright: ignore[reportMissingImports]
from services import accountService

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


# POST /api/v1/accounts - Open a new account
@router.post("", status_code=201)
def open_account(payload: AccountCreate): 
    """Open a new account for an existing, active customer."""
    account = accountService.open_account(
        customer_id=payload.customer_id, 
        account_type=payload.account_type, 
        opening_balance=payload.opening_balance, 
        minimum_balance=payload.minimum_balance, 
        overdraft_limit=payload.overdraft_limit, 
    )
    return account.to_dict()