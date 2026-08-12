"""Seed data for local development and demos.

Runs once when the app starts so in-memory branches/customers exist for
customer endpoints. Postgres demo accounts (ACC-123 / ACC-456) are seeded
separately by models.database.seed_demo_accounts() during startup.

STATUS: NOT currently called by anything. main.py's startup used to call
seed_demo_data() here, but switched to seed_demo_customers() in
models/database.py instead (branches/customers now seed straight into
Postgres there). This function still builds in-memory branches/customers
via models/repository.py, which is itself no longer wired into the app --
see the note at the top of repository.py. Kept for now as reference, not
part of the live startup sequence.
"""

from sqlalchemy.orm import Session
from models.database import CustomerDB
from models.domain import Branch, Customer
from models.repository import repository

DEMO_CUSTOMERS = [
    ("CUST-01", "Aisha Khan", "aisha@example.com", "BR001"),
    ("CUST-02", "Ben Owusu", "ben@example.com", "BR001"),
    ("CUST-03", "Chen Wei", "chen@example.com", "BR002"),
]


def seed_demo_data(db: Session):
    """Create two branches and three in-memory customers."""
    repository.add_branch(Branch("BR001", "Downtown", "MGR-01"))
    repository.add_branch(Branch("BR002", "Harbour", "MGR-02"))

    for customer_id, name, email, branch_id in DEMO_CUSTOMERS:
        if db.get(CustomerDB, customer_id) is None:
            db.add(CustomerDB(customer_id=customer_id, name=name, email=email, branch_id=branch_id, is_active=True))
        repository.add_customer(Customer(customer_id, name, email, branch_id))
    db.commit()