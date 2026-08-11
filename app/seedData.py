"""Seed data for local development and demos.

Runs once when the app starts so in-memory branches/customers exist for
customer endpoints. Postgres demo accounts (ACC-123 / ACC-456) are seeded
separately by models.database.seed_demo_accounts() during startup.
"""

from models.domain import Branch, Customer
from models.repository import repository


def seed_demo_data():
    """Create two branches and three in-memory customers."""
    repository.add_branch(Branch("BR001", "Downtown", "MGR-01"))
    repository.add_branch(Branch("BR002", "Harbour", "MGR-02"))

    repository.add_customer(
        Customer("CUST-01", "Aisha Khan", "aisha@example.com", "BR001")
    )
    repository.add_customer(
        Customer("CUST-02", "Ben Owusu", "ben@example.com", "BR001")
    )
    repository.add_customer(
        Customer("CUST-03", "Chen Wei", "chen@example.com", "BR002")
    )
