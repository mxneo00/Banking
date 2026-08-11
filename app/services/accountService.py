"""Business logic for opening, reading, and depositing into accounts (Postgres)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.db_models import AccountModel
from models.exceptions import NotFoundError, ValidationError


def _next_account_number(db: Session) -> str:
    """Generate the next AC#### number from existing rows."""
    numbers = db.scalars(select(AccountModel.account_number)).all()
    max_n = 1000
    for number in numbers:
        if number.startswith("AC") and number[2:].isdigit():
            max_n = max(max_n, int(number[2:]))
    return f"AC{max_n + 1}"


def open_account(
    db: Session,
    customer_id: str,
    account_type: str,
    opening_balance: float = 0.0,
    minimum_balance: float | None = None,
    overdraft_limit: float | None = None,
) -> AccountModel:
    """Open a savings or checking account and persist it to Postgres."""
    if account_type not in ("savings", "checking"):
        raise ValidationError(
            f"account_type must be 'savings' or 'checking', got '{account_type}'."
        )
    if not customer_id or not customer_id.strip():
        raise ValidationError("customer_id is required and cannot be empty.")
    if opening_balance < 0:
        raise ValidationError("Opening balance cannot be negative.")

    # Defaults match the domain classes when the client omits these fields.
    min_bal = None
    od_limit = None
    if account_type == "savings":
        min_bal = 100.0 if minimum_balance is None else minimum_balance
    else:
        od_limit = 500.0 if overdraft_limit is None else overdraft_limit

    account = AccountModel(
        account_number=_next_account_number(db),
        customer_id=customer_id.strip(),
        account_type=account_type,
        balance=round(float(opening_balance), 2),
        minimum_balance=min_bal,
        overdraft_limit=od_limit,
        branch_code="BR001",
    )
    db.add(account)
    db.flush()
    return account


def get_account(db: Session, account_number: str) -> AccountModel:
    """Fetch a single account by number; raises NotFoundError if missing."""
    account = db.get(AccountModel, account_number)
    if account is None:
        raise NotFoundError(f"Account '{account_number}' does not exist.")
    return account


def deposit(db: Session, account_number: str, amount: float) -> AccountModel:
    """Add a positive amount to an account balance."""
    if amount <= 0:
        raise ValidationError("Deposit amount must be greater than zero.")

    account = get_account(db, account_number)
    account.balance = round(account.balance + float(amount), 2)
    db.flush()
    return account
