"""HTTP-level tests for app/controllers/transaction_controller.py.

main.py can't be imported directly in this branch (it wires up
account_controller/branch_controller modules that don't exist yet), so
these tests mount just the transaction router into a throwaway FastAPI app
-- enough to exercise routing, request validation, and status codes.
"""

import copy

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import services.transactionService as transaction_service
from controllers.transactionController import router as transaction_router


ORIGINAL_ACCOUNTS = {
    "ACC-123": {"id": "ACC-123", "balance": 5000.0, "is_active": True},
    "ACC-456": {"id": "ACC-456", "balance": 250.0, "is_active": True},
}


@pytest.fixture(autouse=True)
def reset_in_memory_state():
    transaction_service._accounts_db.clear()
    transaction_service._accounts_db.update(copy.deepcopy(ORIGINAL_ACCOUNTS))
    transaction_service._transactions_db.clear()
    yield
    transaction_service._accounts_db.clear()
    transaction_service._accounts_db.update(copy.deepcopy(ORIGINAL_ACCOUNTS))
    transaction_service._transactions_db.clear()


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(transaction_router)
    return TestClient(app)


# ---------------------------------------------------------------------------
# POST /api/v1/transactions/transfer
#
# NOTE: every success path below calls Transaction.to_dict() to build the
# response, which currently raises AttributeError (see test_domain.py /
# test_transaction_service.py). TestClient re-raises server-side exceptions
# by default, so we assert that failure explicitly rather than a 201 -- once
# the to_dict()/self.transaction_type bug is fixed, these should be updated
# to assert on the 201 response body instead.
# ---------------------------------------------------------------------------

class TestTransferEndpoint:
    def test_valid_transfer_hits_the_to_dict_bug(self, client):
        with pytest.raises(AttributeError, match="transaction_type"):
            client.post(
                "/api/v1/transactions/transfer",
                json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 100.0},
            )

    def test_valid_transfer_still_moves_the_funds_before_failing_to_serialize(self, client):
        with pytest.raises(AttributeError):
            client.post(
                "/api/v1/transactions/transfer",
                json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 100.0},
            )
        # process_transfer() itself succeeded; only the response serialization failed.
        assert transaction_service._accounts_db["ACC-123"]["balance"] == 4900.0

    def test_rejects_non_positive_amount_before_touching_the_service(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 0},
        )
        assert response.status_code == 422
        # Balances must be untouched: request validation runs before the service.
        assert transaction_service._accounts_db["ACC-123"]["balance"] == 5000.0

    def test_rejects_missing_required_field(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"to_account_id": "ACC-456", "amount": 100.0},
        )
        assert response.status_code == 422

    def test_returns_404_for_unknown_account_without_hitting_serialization(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "NO-SUCH-ACC", "to_account_id": "ACC-456", "amount": 100.0},
        )
        assert response.status_code == 404

    def test_returns_400_for_insufficient_funds(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-456", "to_account_id": "ACC-123", "amount": 99999.0},
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/v1/transactions/{transaction_id}
# ---------------------------------------------------------------------------

class TestGetTransactionEndpoint:
    def test_unknown_id_returns_404(self, client):
        response = client.get("/api/v1/transactions/does-not-exist")
        assert response.status_code == 404

    def test_known_id_hits_the_to_dict_bug(self, client):
        txn = transaction_service.process_transfer("ACC-123", "ACC-456", 10.0, None)
        with pytest.raises(AttributeError, match="transaction_type"):
            client.get(f"/api/v1/transactions/{txn.transaction_id}")


# ---------------------------------------------------------------------------
# GET /api/v1/transactions
# ---------------------------------------------------------------------------

class TestListTransactionsEndpoint:
    def test_empty_ledger_returns_empty_list(self, client):
        response = client.get("/api/v1/transactions")
        assert response.status_code == 200
        assert response.json() == []

    def test_non_empty_ledger_hits_the_to_dict_bug(self, client):
        transaction_service.process_transfer("ACC-123", "ACC-456", 10.0, None)
        with pytest.raises(AttributeError, match="transaction_type"):
            client.get("/api/v1/transactions")
