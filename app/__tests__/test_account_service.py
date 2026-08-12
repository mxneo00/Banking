"""Tests for app/services/accountService.py.

These hit the real Postgres database (see conftest.py's autouse fixture) --
accountService takes a SQLAlchemy session and writes Account rows directly.
`docker compose up -d db` must be running before these tests execute.
"""

import pytest

from models.database import SessionLocal
from models.exceptions import NotFoundError
from services import accountService


class TestOpenAccount:
    def test_opens_a_checking_account_with_default_overdraft(self):
        # Unspecified overdraft_limit should land at the checking default (500).
        with SessionLocal() as db:
            account = accountService.open_account(
                db, customer_id="CUST-01", account_type="checking", opening_balance=250.0,
            )
            db.commit()

        assert account.account_type == "checking"
        assert account.customer_id == "CUST-01"
        assert account.balance == 250.0
        assert account.overdraft_limit == 500.0
        assert account.minimum_balance is None
        assert account.branch_code == "BR001"
        assert account.is_active is True
        assert account.account_number.startswith("AC")

    def test_raises_not_found_for_unknown_customer(self):
        with SessionLocal() as db:
            with pytest.raises(NotFoundError, match="does not exist"):
                accountService.open_account(
                    db, customer_id="NO-SUCH-CUST", account_type="checking",
                )


class TestGetAccount:
    def test_returns_the_opened_account(self):
        with SessionLocal() as db:
            opened = accountService.open_account(
                db, customer_id="CUST-01", account_type="checking",
            )
            db.commit()
            found = accountService.get_account(db, opened.account_number)

        assert found.account_number == opened.account_number
        assert found.customer_id == "CUST-01"
        assert found.account_type == "checking"
