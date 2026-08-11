"""SQLAlchemy setup + ORM models backing the transaction endpoints.

This is a first, narrow slice of real Postgres persistence: just enough to
back deposits/withdrawals/transfers with a real database, matching the
`from models.database import SessionLocal, Account, Transaction` shape
already used elsewhere. Customers, branches, and account *opening* still go
through the in-memory repository (models/repository.py) for now -- moving
those onto Postgres too is a follow-up, not part of this slice.

Copy .env.example to .env in the project root (and adjust credentials if
yours differ) before running anything that imports this module --
DATABASE_URL is required.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

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


class Account(Base):
    """A minimal, Postgres-backed account -- just enough for transactions to
    move real money between real rows. `account_number` matches the ids the
    rest of the app already uses (e.g. "AC1001", or "ACC-123" for manual
    testing/demo data).
    """

    __tablename__ = "accounts"

    account_number = Column(String, primary_key=True)
    balance = Column(Float, nullable=False, default=0.0)
    is_active = Column(Boolean, nullable=False, default=True)


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


def init_db():
    """Create tables that don't exist yet.

    Fine for this teaching project at this stage; swap for Alembic
    migrations once the schema needs to change safely against real data.
    """
    Base.metadata.create_all(bind=engine)


def seed_demo_accounts():
    """Insert a couple of demo accounts if the table is empty, so there's
    something to transfer between right away. Idempotent -- safe to call on
    every startup."""
    with SessionLocal() as session:
        if session.query(Account).first() is not None:
            return
        session.add_all([
            Account(account_number="ACC-123", balance=5000.0, is_active=True),
            Account(account_number="ACC-456", balance=250.0, is_active=True),
        ])
        session.commit()
