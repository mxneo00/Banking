"""SQLAlchemy setup + ORM models for Postgres persistence.

Accounts and transactions live here. Account opening/lookup go through
accountService; deposits/withdrawals/transfers go through transactionService.
Customers and branches may still use the in-memory repository for now.

Copy .env.example to .env in the project root (and adjust credentials if
yours differ) before running anything that imports this module --
DATABASE_URL is required.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, create_engine
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


def get_db():
    """FastAPI dependency: one SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


def init_db():
    """Create tables that don't exist yet.

    Fine for this teaching project at this stage; swap for Alembic
    migrations once the schema needs to change safely against real data.
    """
    Base.metadata.create_all(bind=engine)


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
    seed_demo_accounts()


def seed_demo_accounts():
    """Insert a couple of demo accounts if the table is empty, so there's
    something to transfer between right away. Idempotent -- safe to call on
    every startup."""
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
