"""HTTP-level tests for app/controllers/transactionController.py.

Mounts just the transaction router into a throwaway FastAPI app; the
service underneath talks to the real Postgres database (see conftest.py's
autouse fixture, which seeds ACC-123 / ACC-456 before every test). No custom
exception handlers are needed here -- transactionService already raises
fastapi.HTTPException directly, which FastAPI handles on its own.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from controllers.transactionController import router as transaction_router
from models.database import SessionLocal, UserORM, UserRole
from security.passwords import hash_password
from services import authService


@pytest.fixture
def client():
    """A TestClient pre-authenticated as an admin.

    Every route here now requires a valid Bearer access token, and POST
    /transactions is teller/admin-only (see security/dependencies.py and
    transactionController.py's RBAC rules). Authenticating as an admin for
    every request keeps this file focused on the HTTP contract (status
    codes, serialization) rather than re-covering RBAC ownership rules,
    which belong with the auth-focused tests instead.
    """
    with SessionLocal() as db:
        db.query(UserORM).delete()  # avoid a stale-email DuplicateError on repeat runs
        db.commit()
        authService.create_staff_user(
            db, email="txn-admin@example.com", password="txnadminpassword", role="admin", branch_id="BR001",
        )
        access_token, _ = authService.login(db, "txn-admin@example.com", "txnadminpassword")

    app = FastAPI()
    app.include_router(transaction_router)
    test_client = TestClient(app)
    test_client.headers.update({"Authorization": f"Bearer {access_token}"})
    return test_client


def _authenticated_client(email: str, password: str, **user_fields) -> TestClient:
    """Mint a user, log them in, and return a TestClient with their Bearer token."""
    with SessionLocal() as db:
        db.query(UserORM).filter(UserORM.email == email).delete()
        db.commit()
        db.add(
            UserORM(
                email=email,
                hashed_password=hash_password(password),
                **user_fields,
            )
        )
        db.commit()
        access_token, _ = authService.login(db, email, password)

    app = FastAPI()
    app.include_router(transaction_router)
    test_client = TestClient(app)
    test_client.headers.update({"Authorization": f"Bearer {access_token}"})
    return test_client


@pytest.fixture
def customer_client():
    """Customer who owns ACC-123 (CUST-01), not ACC-456 (CUST-02)."""
    return _authenticated_client(
        "txn-customer@example.com",
        "customerpassword",
        role=UserRole.CUSTOMER.value,
        customer_id="CUST-01",
    )


@pytest.fixture
def teller_client():
    return _authenticated_client(
        "txn-teller@example.com",
        "tellerpassword",
        role=UserRole.TELLER.value,
        branch_id="BR001",
    )


# ---------------------------------------------------------------------------
# POST /api/v1/transactions
# ---------------------------------------------------------------------------

class TestCreateTransactionEndpoint:
    def test_creates_a_record_and_returns_201(self, client):
        response = client.post(
            "/api/v1/transactions",
            json={"to_account": "ACC-123", "amount": 50.0, "transaction_type": "Deposit"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "Deposit"
        assert body["to_account_id"] == "ACC-123"

    def test_rejects_invalid_transaction_type(self, client):
        response = client.post(
            "/api/v1/transactions",
            json={"to_account": "ACC-123", "amount": 50.0, "transaction_type": "Bogus"},
        )
        assert response.status_code == 400

    def test_rejects_missing_amount(self, client):
        response = client.post(
            "/api/v1/transactions",
            json={"to_account": "ACC-123", "transaction_type": "Deposit"},
        )
        assert response.status_code == 422  # amount is required on TransactionCreate

    def test_withdrawal_debits_the_account(self, client):
        response = client.post(
            "/api/v1/transactions",
            json={"from_account": "ACC-123", "amount": 50.0, "transaction_type": "Withdrawal"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "Withdrawal"
        assert body["from_account_id"] == "ACC-123"
        assert body["to_account_id"] is None

    def test_deposit_rejects_a_from_account(self, client):
        response = client.post(
            "/api/v1/transactions",
            json={
                "from_account": "ACC-123", "to_account": "ACC-456",
                "amount": 50.0, "transaction_type": "Deposit",
            },
        )
        assert response.status_code == 400

    def test_transfer_via_create_transaction_moves_both_accounts(self, client):
        response = client.post(
            "/api/v1/transactions",
            json={
                "from_account": "ACC-123", "to_account": "ACC-456",
                "amount": 100.0, "transaction_type": "Transfer",
            },
        )
        assert response.status_code == 201
        assert response.json()["type"] == "Transfer"


# ---------------------------------------------------------------------------
# POST /api/v1/transactions/transfer
# ---------------------------------------------------------------------------

class TestTransferEndpoint:
    def test_valid_transfer_returns_201_with_serialized_transaction(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 100.0},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "Transfer"
        assert body["from_account_id"] == "ACC-123"
        assert body["to_account_id"] == "ACC-456"
        assert body["description"] == "Fund Transfer"

    def test_rejects_non_positive_amount_before_touching_the_service(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 0},
        )
        assert response.status_code == 422

    def test_rejects_missing_required_field(self, client):
        response = client.post(
            "/api/v1/transactions/transfer",
            json={"to_account_id": "ACC-456", "amount": 100.0},
        )
        assert response.status_code == 422

    def test_returns_404_for_unknown_account(self, client):
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

    def test_known_id_returns_the_transaction(self, client):
        created = client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 10.0},
        ).json()

        response = client.get(f"/api/v1/transactions/{created['transaction_id']}")
        assert response.status_code == 200
        assert response.json()["transaction_id"] == created["transaction_id"]


# ---------------------------------------------------------------------------
# GET /api/v1/transactions
# ---------------------------------------------------------------------------

class TestListTransactionsEndpoint:
    def test_empty_ledger_returns_empty_list(self, client):
        response = client.get("/api/v1/transactions")
        assert response.status_code == 200
        assert response.json() == []

    def test_lists_recorded_transactions(self, client):
        client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 10.0},
        )
        response = client.get("/api/v1/transactions")
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_filters_by_type(self, client):
        client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 10.0},
        )
        client.post(
            "/api/v1/transactions",
            json={"to_account": "ACC-123", "amount": 20.0, "transaction_type": "Deposit"},
        )

        response = client.get("/api/v1/transactions", params={"transaction_type": "Deposit"})
        results = response.json()
        assert len(results) == 1
        assert results[0]["type"] == "Deposit"


# ---------------------------------------------------------------------------
# RBAC — customer vs staff on transfers / cash desk
# ---------------------------------------------------------------------------

class TestTransferRbac:
    def test_customer_can_send_from_own_account_to_another_customer(self, customer_client):
        response = customer_client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-123", "to_account_id": "ACC-456", "amount": 25.0},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["from_account_id"] == "ACC-123"
        assert body["to_account_id"] == "ACC-456"

    def test_customer_cannot_send_from_someone_elses_account(self, customer_client):
        response = customer_client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-456", "to_account_id": "ACC-123", "amount": 10.0},
        )
        assert response.status_code == 403

    def test_customer_cannot_deposit_or_withdraw(self, customer_client):
        deposit = customer_client.post(
            "/api/v1/transactions",
            json={"to_account": "ACC-123", "amount": 10.0, "transaction_type": "Deposit"},
        )
        withdrawal = customer_client.post(
            "/api/v1/transactions",
            json={"from_account": "ACC-123", "amount": 10.0, "transaction_type": "Withdrawal"},
        )
        assert deposit.status_code == 403
        assert withdrawal.status_code == 403

    def test_teller_can_transfer_from_any_account(self, teller_client):
        response = teller_client.post(
            "/api/v1/transactions/transfer",
            json={"from_account_id": "ACC-456", "to_account_id": "ACC-123", "amount": 15.0},
        )
        assert response.status_code == 201
        assert response.json()["from_account_id"] == "ACC-456"
