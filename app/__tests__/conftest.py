"""Shared pytest configuration for the app test suite.

The app's own modules use bare imports (``from models.domain import ...``,
``from services import transactionService``) that only resolve when the
``app/`` directory itself is on ``sys.path`` -- i.e. when running
``uvicorn main:app`` from inside ``app/``. Tests live one level deeper
(``app/__tests__/``), so we add ``app/`` to ``sys.path`` here before any
test module tries those same imports.
"""

import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import pytest  # noqa: E402  (import must follow the sys.path fixup above)

from models.database import Account, SessionLocal, Transaction, init_db  # noqa: E402

# transactionService talks to Postgres directly (no in-memory swap for this
# slice) -- these two accounts back every transaction test.
SEED_ACCOUNTS = [
    {"account_number": "ACC-123", "balance": 5000.0, "is_active": True},
    {"account_number": "ACC-456", "balance": 250.0, "is_active": True},
]


@pytest.fixture(autouse=True)
def reset_transaction_tables():
    """Give every test a clean `accounts`/`transactions` table, seeded with
    two known accounts, backed by the real Postgres in docker-compose.

    Run `docker compose up -d db` before running pytest -- there is no
    in-memory fallback for the transaction tests.
    """
    init_db()
    _clear_and_seed()
    yield
    _clear_and_seed(seed=False)


def _clear_and_seed(seed=True):
    with SessionLocal() as session:
        session.query(Transaction).delete()
        session.query(Account).delete()
        if seed:
            session.add_all(Account(**a) for a in SEED_ACCOUNTS)
        session.commit()
