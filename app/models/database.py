"""SQLAlchemy setup + ORM models for Postgres persistence.

Every resource (customers, accounts, transactions, users, budgets) is
Postgres-backed via the ORM models in this file. Account opening/lookup go
through accountService; deposits/withdrawals/transfers go through
transactionService.

Copy .env.example to .env in the project root (and adjust credentials if
yours differ) before running anything that imports this module --
DATABASE_URL is required.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# This file: app/models/database.py -> parents[2] is the project root.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env in the project "
        "root and adjust it if your Postgres credentials differ."
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


class CustomerDB(Base):
    """A minimal, Postgres-backed customer -- just enough for transactions to
    move real money between real rows. `customer_id` matches the ids the
    rest of the app already uses (e.g. "CUST-01", or "CUST-123" for manual
    testing/demo data).
    """

    __tablename__ = "customers"

    customer_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    branch_id = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # The FK lives on Account.customer_id; this is the "list of this
    # customer's accounts" the relational way -- no redundant array of
    # account ids stored on the customer row, just query/traverse the FK.
    accounts = relationship("Account", back_populates="customer")
    budgets = relationship("BudgetORM", back_populates="customer")


class Account(Base):
    """Postgres-backed bank account used by account and transaction endpoints."""

    __tablename__ = "accounts"

    account_number = Column(String(32), primary_key=True)
    customer_id = Column(String(64), ForeignKey("customers.customer_id"), nullable=False)
    account_type = Column(String(16), nullable=False)  # "savings" | "checking"
    balance = Column(Float, nullable=False, default=0.0)
    minimum_balance = Column(Float, nullable=True)
    overdraft_limit = Column(Float, nullable=True)
    branch_code = Column(String(32), nullable=False, default="BR001")
    is_active = Column(Boolean, nullable=False, default=True)

    customer = relationship("CustomerDB", back_populates="accounts")

    def to_dict(self) -> dict:
        data = {
            "account_number": self.account_number,
            "customer_id": self.customer_id,
            "account_type": self.account_type,
            "balance": self.balance,
            "branch_code": self.branch_code,
            "is_active": self.is_active,
        }
        if self.minimum_balance is not None:
            data["minimum_balance"] = self.minimum_balance
        if self.overdraft_limit is not None:
            data["overdraft_limit"] = self.overdraft_limit
        return data


class Transaction(Base):
    """One row per deposit, withdrawal, or transfer."""

    __tablename__ = "transactions"

    id = Column(String, primary_key=True)
    from_account_id = Column(String, ForeignKey("accounts.account_number"), nullable=True)
    to_account_id = Column(String, ForeignKey("accounts.account_number"), nullable=True)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    type = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)


class TransactionType(Enum):
    """Valid values for Transaction.type above -- also what
    services/transactionService.py validates an incoming
    `transaction_type` string against (see its create_transaction)."""

    DEPOSIT = "Deposit"
    WITHDRAWAL = "Withdrawal"
    TRANSFER = "Transfer"


class UserRole(Enum):
    """The four RBAC roles so far implemented.

    Subclassing `str` alongside `Enum` means a UserRole member IS a string
    for all practical purposes (`UserRole.CUSTOMER == "customer"` is True,
    it JSON-serializes as a plain string, etc.) while still giving us
    `UserRole("customer")` validation and IDE autocomplete on `.CUSTOMER`.
    """

    CUSTOMER = "customer"
    TELLER = "teller"
    BRANCH_MANAGER = "branch_manager"
    ADMIN = "admin"
    
    
# Roles allowed to act "on behalf of" a customer instead of only themselves
# i.e. everyone who isn't a plain CUSTOMER. Used throughout the RBAC checks
# in the controllers/services below (e.g. "is this a customer viewing their
# own account, or a staff member who can view anyone's?").
STAFF_ROLES = (UserRole.TELLER, UserRole.BRANCH_MANAGER, UserRole.ADMIN)


class UserORM(Base):
    """A login identity: email + hashed password + role.

    Deliberately separate from CustomerDB -- `UserORM` is "who can log in and
    what are they allowed to do" (auth/authorization), `CustomerDB` is "the
    bank's profile of a customer" (business data). A CUSTOMER-role user is
    linked to their own CustomerDB row via `customer_id`; staff users
    (teller/branch_manager/admin) leave `customer_id` null since they aren't
    bank customers themselves.
    """

    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # one of UserRole's values

    # Only set for role == CUSTOMER. Nullable FK (not every user is a
    # customer), so no ondelete cascade -- deactivating/removing a customer
    # profile shouldn't silently delete their login.
    customer_id = Column(String, ForeignKey("customers.customer_id"), nullable=True)

    # Which branch a teller/branch_manager works out of. Plain string for
    # now (no `branches` table exists yet), same as CustomerDB.branch_id
    # and Account.branch_code elsewhere in this file.
    branch_id = Column(String, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Bumped by authService.logout(). Every access/refresh token embeds the
    # token_version it was issued under (see security/tokens.py); on each
    # request, get_current_user compares the token's version against this
    # column and rejects it on a mismatch. Logging out increments this,
    # which instantly invalidates every token issued before that moment --
    # no denylist table needed, just one integer.
    token_version = Column(Integer, nullable=False, default=0)

    def to_dict(self) -> dict:
        """Serialized view for API responses. Never includes hashed_password
        or token_version -- the latter is an internal revocation mechanism,
        not something a client needs to see."""
        return {
            "user_id": self.user_id,
            "email": self.email,
            "role": self.role,
            "customer_id": self.customer_id,
            "branch_id": self.branch_id,
            "is_active": self.is_active,
            "created_at": self.created_at,
        }

class BudgetORM(Base):
    """A budget for a specific category, amount, and period (weekly, monthly, yearly) for a customer."""

    __tablename__ = "budgets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.customer_id"), nullable=False)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    period = Column(String, nullable=False)  # "weekly" | "monthly"
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    customer = relationship("CustomerDB", back_populates="budgets")

def init_db():
    """Create tables that don't exist yet.

    Fine for this teaching project at this stage; swap for Alembic
    migrations once the schema needs to change safely against real data.
    """
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: one SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_db(confirm: bool = False):
    """Drop all tables and recreate them. Dev/reset use only."""
    if not confirm:
        raise ValueError("You must pass confirm=True to reset the database.")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def reset_and_seed_db(confirm: bool = False):
    """Drop all tables, recreate them, and seed the full local demo set."""
    if not confirm:
        raise ValueError("You must pass confirm=True to reset the database.")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_all_demo_data()


def seed_all_demo_data():
    """Run every idempotent demo seed in FK-safe order."""
    seed_demo_customers()
    seed_demo_accounts()
    seed_demo_admin()
    seed_demo_staff()
    seed_demo_customer_logins()
    seed_demo_transactions()
    seed_demo_budgets()


def _customer_by_email(session, email: str) -> CustomerDB | None:
    return session.query(CustomerDB).filter(CustomerDB.email == email).first()


def _allocate_customer_id(session, preferred_id: str, reserved: set[str]) -> str:
    """Use preferred_id when free; otherwise DEMO-01, DEMO-02, ...

    `reserved` covers ids already chosen in this seed pass (pending inserts
    are invisible to session.get until flush).
    """
    if preferred_id not in reserved and session.get(CustomerDB, preferred_id) is None:
        reserved.add(preferred_id)
        return preferred_id
    n = 1
    while True:
        candidate = f"DEMO-{n:02d}"
        if candidate not in reserved and session.get(CustomerDB, candidate) is None:
            reserved.add(candidate)
            return candidate
        n += 1


def seed_demo_customers():
    """Ensure demo customers exist, keyed by email (not only preferred ids).

    Local DBs often already have CUST-03/04/05 from Postman/manual tests.
    Skipping solely on customer_id left Elena (BR002) missing forever.
    """
    demo_customers = [
        ("CUST-01", "Aisha Khan", "aisha@example.com", "BR001", True),
        ("CUST-02", "Ben Owusu", "ben@example.com", "BR001", True),
        ("CUST-03", "Cara Diaz", "cara@example.com", "BR001", True),  # no accounts
        ("CUST-04", "Dan Lee", "dan@example.com", "BR001", False),  # inactive
        ("CUST-05", "Elena Ng", "elena@example.com", "BR002", True),
    ]
    with SessionLocal() as session:
        changed = False
        reserved: set[str] = set()
        for preferred_id, name, email, branch_id, is_active in demo_customers:
            existing = _customer_by_email(session, email)
            if existing is not None:
                reserved.add(existing.customer_id)
                if (
                    existing.name != name
                    or existing.branch_id != branch_id
                    or existing.is_active != is_active
                ):
                    existing.name = name
                    existing.branch_id = branch_id
                    existing.is_active = is_active
                    changed = True
                continue
            session.add(
                CustomerDB(
                    customer_id=_allocate_customer_id(session, preferred_id, reserved),
                    name=name,
                    email=email,
                    branch_id=branch_id,
                    is_active=is_active,
                )
            )
            changed = True
        if changed:
            session.commit()


def seed_demo_accounts():
    """Ensure demo accounts exist; owner resolved by customer email."""
    # number, owner_email, type, balance, min_bal, overdraft, branch
    demo_accounts = [
        ("ACC-123", "aisha@example.com", "checking", 5000.0, None, 500.0, "BR001"),
        ("ACC-124", "aisha@example.com", "savings", 1200.0, 100.0, None, "BR001"),
        ("ACC-456", "ben@example.com", "checking", 250.0, None, 500.0, "BR001"),
        ("ACC-789", "elena@example.com", "checking", 1800.0, None, 500.0, "BR002"),
    ]
    with SessionLocal() as session:
        changed = False
        for number, owner_email, account_type, balance, min_bal, overdraft, branch in demo_accounts:
            owner = _customer_by_email(session, owner_email)
            if owner is None:
                continue
            account = session.get(Account, number)
            if account is None:
                session.add(
                    Account(
                        account_number=number,
                        customer_id=owner.customer_id,
                        account_type=account_type,
                        balance=balance,
                        minimum_balance=min_bal,
                        overdraft_limit=overdraft,
                        branch_code=branch,
                        is_active=True,
                    )
                )
                changed = True
                continue
            # Repair ownership if an older seed attached the number to the wrong id.
            if account.customer_id != owner.customer_id or account.branch_code != branch:
                account.customer_id = owner.customer_id
                account.branch_code = branch
                changed = True
        if changed:
            session.commit()


def seed_demo_admin():
    """Insert the bootstrap ADMIN login if that email is missing.

    Bootstrapping problem this solves: creating a staff user normally
    requires an existing ADMIN to call POST /auth/staff. Idempotent by email.
    """
    from security.passwords import hash_password

    with SessionLocal() as session:
        if session.query(UserORM).filter(UserORM.email == "admin@bank.local").first() is not None:
            return
        session.add(
            UserORM(
                email="admin@bank.local",
                hashed_password=hash_password("admin123"),
                role=UserRole.ADMIN.value,
                is_active=True,
            )
        )
        session.commit()


def seed_demo_staff():
    """Insert local-dev staff logins (teller / manager / BR002 teller) by email."""
    from security.passwords import hash_password

    demo_staff = [
        ("teller@bank.local", "teller123", UserRole.TELLER.value, "BR001"),
        ("manager@bank.local", "manager123", UserRole.BRANCH_MANAGER.value, "BR001"),
        ("teller.east@bank.local", "teller123", UserRole.TELLER.value, "BR002"),
    ]

    with SessionLocal() as session:
        added = False
        for email, password, role, branch_id in demo_staff:
            exists = session.query(UserORM).filter(UserORM.email == email).first()
            if exists is not None:
                continue
            session.add(
                UserORM(
                    email=email,
                    hashed_password=hash_password(password),
                    role=role,
                    branch_id=branch_id,
                    is_active=True,
                )
            )
            added = True
        if added:
            session.commit()


def seed_demo_customer_logins():
    """Link login users to demo customers so the customer portal is demoable.

    Idempotent by email. Resolves customer_id from the customer email row so
    logins stay correct when preferred CUST-0x ids were already taken.
    Skips inactive Dan (no login).
    """
    from security.passwords import hash_password

    demo_logins = [
        ("aisha@example.com", "customer123"),
        ("ben@example.com", "customer123"),
        ("cara@example.com", "customer123"),
        ("elena@example.com", "customer123"),
    ]

    with SessionLocal() as session:
        changed = False
        for email, password in demo_logins:
            customer = _customer_by_email(session, email)
            if customer is None:
                continue
            user = session.query(UserORM).filter(UserORM.email == email).first()
            if user is None:
                session.add(
                    UserORM(
                        email=email,
                        hashed_password=hash_password(password),
                        role=UserRole.CUSTOMER.value,
                        customer_id=customer.customer_id,
                        branch_id=customer.branch_id,
                        is_active=True,
                    )
                )
                changed = True
                continue
            if (
                user.customer_id != customer.customer_id
                or user.branch_id != customer.branch_id
                or user.role != UserRole.CUSTOMER.value
            ):
                user.customer_id = customer.customer_id
                user.branch_id = customer.branch_id
                user.role = UserRole.CUSTOMER.value
                changed = True
        if changed:
            session.commit()


def seed_demo_transactions():
    """Insert a fixed set of recent ledger rows for UI demos (by transaction id).

    Account balances above are the intended *current* balances; these rows are
    history for Branch overview / transaction tables (not replayed onto balances).
    """
    now = datetime.now(timezone.utc)
    # id, from, to, amount, type, description, days_ago, hours
    demo_txns = [
        ("demo-txn-001", None, "ACC-123", 500.0, "Deposit", "Payroll deposit", 6, 10),
        ("demo-txn-002", "ACC-123", None, 75.0, "Withdrawal", "ATM withdrawal", 5, 14),
        ("demo-txn-003", "ACC-123", "ACC-456", 200.0, "Transfer", "Pay Ben", 4, 11),
        ("demo-txn-004", "ACC-123", "ACC-124", 300.0, "Transfer", "Move to savings", 3, 16),
        ("demo-txn-005", None, "ACC-124", 100.0, "Deposit", "Interest credit", 3, 9),
        ("demo-txn-006", "ACC-456", None, 40.0, "Withdrawal", "Cash out", 2, 13),
        ("demo-txn-007", None, "ACC-789", 250.0, "Deposit", "BR002 deposit", 2, 10),
        ("demo-txn-008", "ACC-789", None, 50.0, "Withdrawal", "BR002 cash", 1, 15),
        ("demo-txn-009", None, "ACC-123", 120.0, "Deposit", "Refund", 1, 11),
        ("demo-txn-010", "ACC-123", "ACC-456", 60.0, "Transfer", "Shared dinner", 0, 9),
        ("demo-txn-011", None, "ACC-456", 80.0, "Deposit", "Side gig", 0, 12),
        ("demo-txn-012", "ACC-124", None, 25.0, "Withdrawal", "Savings ATM", 0, 14),
    ]

    with SessionLocal() as session:
        added = False
        for txn_id, from_acct, to_acct, amount, txn_type, description, days_ago, hour in demo_txns:
            if session.get(Transaction, txn_id) is not None:
                continue
            # Skip if referenced accounts were never seeded (partial DB).
            if from_acct and session.get(Account, from_acct) is None:
                continue
            if to_acct and session.get(Account, to_acct) is None:
                continue
            ts = (now - timedelta(days=days_ago)).replace(hour=hour, minute=15, second=0, microsecond=0)
            session.add(
                Transaction(
                    id=txn_id,
                    from_account_id=from_acct,
                    to_account_id=to_acct,
                    amount=amount,
                    description=description,
                    type=txn_type,
                    timestamp=ts,
                )
            )
            added = True
        if added:
            session.commit()


def seed_demo_budgets():
    """Insert starter budgets for Aisha so the Budgets page has data."""
    demo_budgets = [
        ("demo-budget-groceries", "Groceries", 400.0, "monthly"),
        ("demo-budget-rent", "Rent", 1600.0, "monthly"),
        ("demo-budget-transport", "Transport", 150.0, "monthly"),
    ]
    with SessionLocal() as session:
        aisha = _customer_by_email(session, "aisha@example.com")
        if aisha is None:
            return
        added = False
        for budget_id, category, amount, period in demo_budgets:
            budget = session.get(BudgetORM, budget_id)
            if budget is None:
                session.add(
                    BudgetORM(
                        id=budget_id,
                        customer_id=aisha.customer_id,
                        category=category,
                        amount=amount,
                        period=period,
                    )
                )
                added = True
            elif budget.customer_id != aisha.customer_id:
                budget.customer_id = aisha.customer_id
                added = True
        if added:
            session.commit()
