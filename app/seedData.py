"""Seed data for local development and demos.

Runs once when the app starts, so there's something to GET right away
instead of an empty API. This calls the same service functions the API
routes call rather than touching the repository directly — that way the
seed data goes through the exact same validation and business rules a
real request would.
"""

from services import accountService, customerService, transactionService


def seed_demo_data():
    """Create two branches, three customers, four accounts, and some activity."""
    #branch_service.create_branch("BR001", "Downtown", "MGR-01")
    #branch_service.create_branch("BR002", "Harbour", "MGR-02")

    customerService.create_customer("CUST-01", "Aisha Khan", "aisha@example.com", "BR001")
    customerService.create_customer("CUST-02", "Ben Owusu", "ben@example.com", "BR001")
    customerService.create_customer("CUST-03", "Chen Wei", "chen@example.com", "BR002")

    savings = accountService.open_account("CUST-01", "savings", opening_balance=1000.0)
    checking = accountService.open_account("CUST-02", "checking", opening_balance=250.0)
    harbour_savings = accountService.open_account(
        "CUST-03", "savings", opening_balance=800.0, minimum_balance=50.0
    )
    accountService.open_account("CUST-03", "checking", opening_balance=0.0, overdraft_limit=200.0)

    # transactionService currently exposes process_transfer (mock ledger), not
    # deposit/withdraw/transfer helpers — seed transfers once accounts exist.
    transactionService.process_transfer(
        savings.account_number, checking.account_number, 150.0, "seed transfer"
    )
    transactionService.process_transfer(
        harbour_savings.account_number, savings.account_number, 75.0, "cross-branch seed"
    )
