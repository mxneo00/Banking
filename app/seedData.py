"""Seed data for local development and demos.

Runs once when the app starts, so there's something to GET right away
instead of an empty API. Customers require an existing branch, so branches
are created first via the repository (there is no branchService yet).

Accounts are seeded into Postgres only when the accounts table is empty,
so restarts do not keep inserting duplicates.
"""

from sqlalchemy import func, select

from database import SessionLocal
from models.db_models import AccountModel
from models.domain import Branch
from models.repository import repository
from services import accountService, customerService


def seed_demo_data():
    """Create two branches, three customers, and (once) four Postgres accounts."""
    repository.add_branch(Branch("BR001", "Downtown", "MGR-01"))
    repository.add_branch(Branch("BR002", "Harbour", "MGR-02"))

    customerService.create_customer("CUST-01", "Aisha Khan", "aisha@example.com", "BR001")
    customerService.create_customer("CUST-02", "Ben Owusu", "ben@example.com", "BR001")
    customerService.create_customer("CUST-03", "Chen Wei", "chen@example.com", "BR002")

    db = SessionLocal()
    try:
        existing = db.scalar(select(func.count()).select_from(AccountModel)) or 0
        if existing > 0:
            return

        accountService.open_account(db, "CUST-01", "savings", opening_balance=1000.0)
        accountService.open_account(db, "CUST-02", "checking", opening_balance=250.0)
        accountService.open_account(
            db, "CUST-03", "savings", opening_balance=800.0, minimum_balance=50.0
        )
        accountService.open_account(
            db, "CUST-03", "checking", opening_balance=0.0, overdraft_limit=200.0
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
