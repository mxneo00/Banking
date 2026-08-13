"""Business logic for opening and reading accounts (Postgres via models.database)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.database import Account, CustomerDB
from models.exceptions import NotFoundError, ValidationError


def _next_account_number(db: Session) -> str:
    """Generate the next AC#### number from existing rows."""
    numbers = db.scalars(select(Account.account_number)).all()
    max_n = 1000
    # Scan every existing number, ignoring ones that don't match the AC####
    # pattern (e.g. the seeded "ACC-123"/"ACC-456"), and take the highest
    # numeric suffix seen so the next one is guaranteed unique.
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
) -> Account:
    """Open a savings or checking account and persist it to Postgres."""
    # Field-level validation first -- cheap checks that don't need the DB,
    # so a malformed request never gets as far as a customer lookup.
    if account_type not in ("savings", "checking"):
        raise ValidationError(
            f"account_type must be 'savings' or 'checking', got '{account_type}'."
        )
    if not customer_id or not customer_id.strip():
        raise ValidationError("customer_id is required and cannot be empty.")
    if opening_balance < 0:
        raise ValidationError("Opening balance cannot be negative.")
    if account_type == "savings" and overdraft_limit is not None:
        raise ValidationError("overdraft_limit does not apply to a savings account.")
    if account_type == "checking" and minimum_balance is not None:
        raise ValidationError("minimum_balance does not apply to a checking account.")

    # Cross-check the relationship before creating the row: the account's
    # customer_id is a real FK, but checking here first gives a clean 404/400
    # instead of a raw IntegrityError, and lets us derive branch_code from
    # the customer the same way the original in-memory version did.
    customer = db.get(CustomerDB, customer_id.strip())
    if customer is None:
        raise NotFoundError(f"Customer '{customer_id}' does not exist.")
    if not customer.is_active:
        raise ValidationError(f"Customer '{customer_id}' is deactivated and cannot open new accounts.")

    # Apply the type-specific default when the caller didn't supply one --
    # savings gets a minimum balance, checking gets an overdraft limit, and
    # each account only ever has one of the two set (see the validation above).
    min_bal = None
    od_limit = None
    if account_type == "savings":
        min_bal = 100.0 if minimum_balance is None else minimum_balance
    else:
        od_limit = 500.0 if overdraft_limit is None else overdraft_limit

    account = Account(
        account_number=_next_account_number(db),
        customer_id=customer.customer_id,
        account_type=account_type,
        balance=round(float(opening_balance), 2),
        minimum_balance=min_bal,
        overdraft_limit=od_limit,
        branch_code=customer.branch_id,
        is_active=True,
    )
    db.add(account)
    db.flush()
    return account


def get_account(db: Session, account_number: str) -> Account:
    """Fetch a single account by number; raises NotFoundError if missing."""
    account = db.get(Account, account_number)
    if account is None:
        raise NotFoundError(f"Account '{account_number}' does not exist.")
    return account
