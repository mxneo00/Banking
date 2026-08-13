"""Shared pytest configuration for the app test suite.

The app's own modules use bare imports (``from models.database import ...``,
``from services import transactionService``) that only resolve when the
``app/`` directory itself is on ``sys.path`` -- i.e. when running
``uvicorn main:app`` from inside ``app/``. Tests live one level deeper
(``app/__tests__/``), so we add ``app/`` to ``sys.path`` here before any
test module tries those same imports.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = APP_DIR.parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

# Redirect the test run at a dedicated `_test`-suffixed database, NEVER the
# one the live app uses. The fixture below wipes customers/accounts/
# transactions/users/budgets between every single test -- pointed at the
# same DATABASE_URL as `uvicorn main:app`, that would destroy real app data
# on every test run. load_dotenv() only fills in vars that aren't already
# set, so setting os.environ["DATABASE_URL"] here (before models.database is
# ever imported) makes models.database's own load_dotenv() call a no-op for
# this var -- it picks up the test URL instead of the one in .env.
load_dotenv(PROJECT_ROOT / ".env")
_base_url = os.environ.get("DATABASE_URL", "")
if _base_url and not _base_url.rsplit("/", 1)[-1].endswith("_test"):
    _base, _, _db_name = _base_url.rpartition("/")
    os.environ["DATABASE_URL"] = f"{_base}/{_db_name}_test"

import pytest  # noqa: E402  (import must follow the sys.path/env fixups above)

from models.database import (  # noqa: E402
    Account,
    BudgetORM,
    CustomerDB,
    SessionLocal,
    Transaction,
    UserORM,
    init_db,
)

# Customers must exist before accounts -- Account.customer_id is a real FK.
SEED_CUSTOMERS = [
    {
        "customer_id": "CUST-01",
        "name": "Aisha Khan",
        "email": "aisha@example.com",
        "branch_id": "BR001",
        "is_active": True,
    },
    {
        "customer_id": "CUST-02",
        "name": "Ben Owusu",
        "email": "ben@example.com",
        "branch_id": "BR001",
        "is_active": True,
    },
]

# transactionService talks to Postgres directly (no in-memory swap for this
# slice) -- these two accounts back every transaction test.
SEED_ACCOUNTS = [
    {
        "account_number": "ACC-123",
        "customer_id": "CUST-01",
        "account_type": "checking",
        "balance": 5000.0,
        "overdraft_limit": 500.0,
        "branch_code": "BR001",
        "is_active": True,
    },
    {
        "account_number": "ACC-456",
        "customer_id": "CUST-02",
        "account_type": "checking",
        "balance": 250.0,
        "overdraft_limit": 500.0,
        "branch_code": "BR001",
        "is_active": True,
    },
]


@pytest.fixture(autouse=True)
def reset_transaction_tables():
    """Give every test a clean customers/accounts/transactions/users/budgets
    table, seeded with two known customers and two known accounts, backed by
    a dedicated Postgres test database (see the DATABASE_URL redirect above).

    A local Postgres server must be reachable at DATABASE_URL (with `_test`
    appended to the database name) before running pytest -- there is no
    in-memory fallback for the account or transaction tests.
    """
    init_db()
    _clear_and_seed()
    yield
    _clear_and_seed(seed=False)


def _clear_and_seed(seed=True):
    with SessionLocal() as session:
        # Deletion order matters: children before parents, or Postgres
        # rejects the delete with a foreign-key violation.
        #   Transaction -> Account (from_account_id/to_account_id FKs)
        #   BudgetORM, Account, UserORM -> CustomerDB (customer_id FKs)
        session.query(Transaction).delete()
        session.query(BudgetORM).delete()
        session.query(Account).delete()
        session.query(UserORM).delete()
        session.query(CustomerDB).delete()
        if seed:
            session.add_all(CustomerDB(**c) for c in SEED_CUSTOMERS)
            session.add_all(Account(**a) for a in SEED_ACCOUNTS)
        session.commit()
