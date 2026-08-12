"""SQLAlchemy setup + ORM models for Postgres persistence.

Accounts and transactions live here. Account opening/lookup go through
accountService; deposits/withdrawals/transfers go through transactionService.
Customers and branches may still use the in-memory repository for now.

Copy .env.example to .env in the project root (and adjust credentials if
yours differ) before running anything that imports this module --
DATABASE_URL is required.
"""

import os
import uuid
from datetime import datetime, timezone
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
    """Drop all tables, recreate them, and seed demo accounts. Dev/reset use only."""
    if not confirm:
        raise ValueError("You must pass confirm=True to reset the database.")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_demo_customers()
    seed_demo_accounts()


def seed_demo_customers():
    """Insert the demo customers seed_demo_accounts()'s accounts belong to,
    if the table is empty. Must run before seed_demo_accounts() -- Account
    now has a real FK onto customers.customer_id."""
    with SessionLocal() as session:
        if session.query(CustomerDB).first() is not None:
            return
        session.add_all([
            CustomerDB(customer_id="CUST-01", name="Aisha Khan", email="aisha@example.com", branch_id="BR001"),
            CustomerDB(customer_id="CUST-02", name="Ben Owusu", email="ben@example.com", branch_id="BR001"),
        ])
        session.commit()


def seed_demo_accounts():
    """Insert a couple of demo accounts if the table is empty, so there's
    something to transfer between right away. Idempotent -- safe to call on
    every startup. Requires seed_demo_customers() to have run first."""
    with SessionLocal() as session:
        if session.query(Account).first() is not None:
            return
        session.add_all([
            Account(
                account_number="ACC-123",
                customer_id="CUST-01",
                account_type="checking",
                balance=5000.0,
                overdraft_limit=500.0,
                branch_code="BR001",
                is_active=True,
            ),
            Account(
                account_number="ACC-456",
                customer_id="CUST-02",
                account_type="checking",
                balance=250.0,
                overdraft_limit=500.0,
                branch_code="BR001",
                is_active=True,
            ),
        ])
        session.commit()


def seed_demo_admin():
    """Insert one ADMIN login if the users table is empty.

    Bootstrapping problem this solves: creating a staff user (teller/
    branch_manager/admin) requires an existing ADMIN to call POST
    /api/v1/auth/staff -- but the very first admin can't be created that
    way, since no admin exists yet to authorize it. So exactly one gets
    seeded directly here. Change this password immediately in anything
    beyond local dev.
    """
    # Local import: security/passwords.py never needs to know about the
    # database, so importing it up top would be an unused dependency for
    # every other function in this module -- only this one seed step
    # actually needs to hash a password.
    from security.passwords import hash_password

    with SessionLocal() as session:
        if session.query(UserORM).first() is not None:
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
