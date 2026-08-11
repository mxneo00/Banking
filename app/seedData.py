"""Seed data for local development and demos.

Runs once when the app starts, so there's something to GET right away
instead of an empty API. Customers require an existing branch, so branches
are created first via the repository (there is no branchService yet).

Customers are written to BOTH Postgres (via customerService, the real
source of truth now) AND the in-memory repository. That's a stopgap, not
the end state: accountService.open_account still reads customers from the
in-memory repository (models/repository.py), which customerService no
longer populates on its own now that customers live in Postgres. Once
account-opening also moves to Postgres, the repository.add_customer call
below should come out.
"""

from models.database import CustomerDB, SessionLocal
from models.domain import Branch, Customer
from models.repository import repository
from services import accountService, customerService

DEMO_CUSTOMERS = [
    ("CUST-01", "Aisha Khan", "aisha@example.com", "BR001"),
    ("CUST-02", "Ben Owusu", "ben@example.com", "BR001"),
    ("CUST-03", "Chen Wei", "chen@example.com", "BR002"),
]


def seed_demo_data():
    """Create two branches, three customers, and four accounts."""
    repository.add_branch(Branch("BR001", "Downtown", "MGR-01"))
    repository.add_branch(Branch("BR002", "Harbour", "MGR-02"))

    with SessionLocal() as db:
        # Postgres persists across restarts (unlike the in-memory repository,
        # which resets every time), so only create rows there if they don't
        # already exist from a previous run.
        already_in_postgres = db.query(CustomerDB).first() is not None
        for customer_id, name, email, branch_id in DEMO_CUSTOMERS:
            if not already_in_postgres:
                customerService.create_customer(db, customer_id, name, email, branch_id)
            repository.add_customer(Customer(customer_id, name, email, branch_id))

    accountService.open_account("CUST-01", "savings", opening_balance=1000.0)
    accountService.open_account("CUST-02", "checking", opening_balance=250.0)
    accountService.open_account(
        "CUST-03", "savings", opening_balance=800.0, minimum_balance=50.0
    )
    accountService.open_account("CUST-03", "checking", opening_balance=0.0, overdraft_limit=200.0)