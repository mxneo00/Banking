"""Tests for app/services/transaction_service.py.

The service keeps its "database" as module-level dicts (_accounts_db,
_transactions_db), so tests reset that state before/after each test to stay
isolated from one another.
"""

import copy

import pytest
from fastapi import HTTPException

import services.transaction_service as transaction_service


ORIGINAL_ACCOUNTS = {
    "ACC-123": {"id": "ACC-123", "balance": 5000.0, "is_active": True},
    "ACC-456": {"id": "ACC-456", "balance": 250.0, "is_active": True},
}


@pytest.fixture(autouse=True)
def reset_in_memory_state():
    """Restore the module's fake DB to a known baseline before each test."""
    transaction_service._accounts_db.clear()
    transaction_service._accounts_db.update(copy.deepcopy(ORIGINAL_ACCOUNTS))
    transaction_service._transactions_db.clear()
    yield
    transaction_service._accounts_db.clear()
    transaction_service._accounts_db.update(copy.deepcopy(ORIGINAL_ACCOUNTS))
    transaction_service._transactions_db.clear()


# ---------------------------------------------------------------------------
# process_transfer
# ---------------------------------------------------------------------------

class TestProcessTransfer:
    def test_moves_funds_between_accounts(self):
        transaction_service.process_transfer("ACC-123", "ACC-456", 100.0, "rent")

        assert transaction_service._accounts_db["ACC-123"]["balance"] == 4900.0
        assert transaction_service._accounts_db["ACC-456"]["balance"] == 350.0

    def test_returns_a_transaction_with_the_requested_fields(self):
        txn = transaction_service.process_transfer("ACC-123", "ACC-456", 100.0, "rent")

        assert txn.from_account_id == "ACC-123"
        assert txn.to_account_id == "ACC-456"
        assert txn.amount == 100.0
        assert txn.description == "rent"
        assert txn.status == "COMPLETED"

    def test_stores_the_transaction_in_the_ledger(self):
        txn = transaction_service.process_transfer("ACC-123", "ACC-456", 100.0, "rent")

        assert transaction_service._transactions_db[txn.transaction_id] is txn

    def test_raises_404_when_source_account_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            transaction_service.process_transfer("NO-SUCH-ACC", "ACC-456", 100.0, None)
        assert exc_info.value.status_code == 404

    def test_raises_404_when_destination_account_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            transaction_service.process_transfer("ACC-123", "NO-SUCH-ACC", 100.0, None)
        assert exc_info.value.status_code == 404

    def test_raises_400_when_source_account_inactive(self):
        transaction_service._accounts_db["ACC-123"]["is_active"] = False
        with pytest.raises(HTTPException) as exc_info:
            transaction_service.process_transfer("ACC-123", "ACC-456", 100.0, None)
        assert exc_info.value.status_code == 400

    def test_raises_400_when_destination_account_inactive(self):
        transaction_service._accounts_db["ACC-456"]["is_active"] = False
        with pytest.raises(HTTPException) as exc_info:
            transaction_service.process_transfer("ACC-123", "ACC-456", 100.0, None)
        assert exc_info.value.status_code == 400

    def test_raises_400_on_insufficient_funds(self):
        with pytest.raises(HTTPException) as exc_info:
            transaction_service.process_transfer("ACC-456", "ACC-123", 99999.0, None)
        assert exc_info.value.status_code == 400

    def test_insufficient_funds_does_not_mutate_balances(self):
        try:
            transaction_service.process_transfer("ACC-456", "ACC-123", 99999.0, None)
        except HTTPException:
            pass
        assert transaction_service._accounts_db["ACC-456"]["balance"] == 250.0
        assert transaction_service._accounts_db["ACC-123"]["balance"] == 5000.0

    def test_failed_transfer_is_not_recorded_in_the_ledger(self):
        try:
            transaction_service.process_transfer("NO-SUCH-ACC", "ACC-456", 100.0, None)
        except HTTPException:
            pass
        assert transaction_service._transactions_db == {}

    def test_transferring_full_balance_is_allowed(self):
        transaction_service.process_transfer("ACC-456", "ACC-123", 250.0, None)
        assert transaction_service._accounts_db["ACC-456"]["balance"] == 0.0


# ---------------------------------------------------------------------------
# get_transaction
# ---------------------------------------------------------------------------

class TestGetTransaction:
    def test_returns_the_stored_transaction(self):
        created = transaction_service.process_transfer("ACC-123", "ACC-456", 100.0, None)
        fetched = transaction_service.get_transaction(created.transaction_id)
        assert fetched is created

    def test_raises_404_for_unknown_id(self):
        with pytest.raises(HTTPException) as exc_info:
            transaction_service.get_transaction("does-not-exist")
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# list_transactions
# ---------------------------------------------------------------------------

class TestListTransactions:
    def test_returns_empty_list_when_no_transactions(self):
        assert transaction_service.list_transactions() == []

    def test_returns_all_transactions_when_unfiltered(self):
        t1 = transaction_service.process_transfer("ACC-123", "ACC-456", 10.0, None)
        t2 = transaction_service.process_transfer("ACC-456", "ACC-123", 5.0, None)

        results = transaction_service.list_transactions()
        assert {t.transaction_id for t in results} == {t1.transaction_id, t2.transaction_id}

    def test_filters_by_start_date(self):
        transaction_service.process_transfer("ACC-123", "ACC-456", 10.0, None)

        # An impossibly far-future start_date should exclude everything,
        # since timestamps are compared as ISO strings.
        results = transaction_service.list_transactions(start_date="9999-01-01")
        assert results == []

    def test_start_date_in_the_past_includes_existing_transactions(self):
        txn = transaction_service.process_transfer("ACC-123", "ACC-456", 10.0, None)

        results = transaction_service.list_transactions(start_date="2000-01-01")
        assert txn.transaction_id in {t.transaction_id for t in results}

    def test_filtering_by_transaction_type_raises_because_type_attribute_is_never_set(self):
        """Known bug: Transaction stores its kind on self.type, but
        list_transactions() filters on t.transaction_type, which no
        Transaction instance ever has. See test_domain.py's matching
        to_dict() bug -- both stem from the same __init__/to_dict mismatch
        in app/models/domain.py.
        """
        transaction_service.process_transfer("ACC-123", "ACC-456", 10.0, None)

        with pytest.raises(AttributeError, match="transaction_type"):
            transaction_service.list_transactions(transaction_type="transfer")
