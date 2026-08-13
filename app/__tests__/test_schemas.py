"""Tests for app/models/schemas.py -- the Pydantic request/response models."""

import pytest
from pydantic import ValidationError

from models.schemas import (
    CustomerCreate,
    CustomerUpdate,
    DepositRequest,
    TransactionCreate,
    TransactionResponse,
    TransferCreate,
    TransferRequest,
    WithdrawRequest,
)


# ---------------------------------------------------------------------------
# DepositRequest / WithdrawRequest -- amount must be strictly positive
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("model_class", [DepositRequest, WithdrawRequest])
class TestAmountMustBePositive:
    def test_accepts_a_positive_amount(self, model_class):
        model = model_class(amount=100.0)
        assert model.amount == 100.0

    def test_rejects_zero(self, model_class):
        with pytest.raises(ValidationError):
            model_class(amount=0)

    def test_rejects_negative_amount(self, model_class):
        with pytest.raises(ValidationError):
            model_class(amount=-50.0)

    def test_amount_is_required(self, model_class):
        with pytest.raises(ValidationError):
            model_class()


# ---------------------------------------------------------------------------
# TransferRequest
# ---------------------------------------------------------------------------

class TestTransferRequest:
    def test_accepts_valid_payload(self):
        req = TransferRequest(from_account_id="ACC-1", to_account_id="ACC-2", amount=50.0)
        assert req.from_account_id == "ACC-1"
        assert req.to_account_id == "ACC-2"
        assert req.amount == 50.0

    def test_description_defaults_to_fund_transfer(self):
        req = TransferRequest(from_account_id="ACC-1", to_account_id="ACC-2", amount=50.0)
        assert req.description == "Fund Transfer"

    def test_description_can_be_overridden(self):
        req = TransferRequest(
            from_account_id="ACC-1", to_account_id="ACC-2", amount=50.0, description="rent"
        )
        assert req.description == "rent"

    def test_rejects_zero_amount(self):
        with pytest.raises(ValidationError):
            TransferRequest(from_account_id="ACC-1", to_account_id="ACC-2", amount=0)

    def test_rejects_negative_amount(self):
        with pytest.raises(ValidationError):
            TransferRequest(from_account_id="ACC-1", to_account_id="ACC-2", amount=-10)

    @pytest.mark.parametrize("missing_field", ["from_account_id", "to_account_id", "amount"])
    def test_requires_core_fields(self, missing_field):
        payload = {"from_account_id": "ACC-1", "to_account_id": "ACC-2", "amount": 50.0}
        del payload[missing_field]
        with pytest.raises(ValidationError):
            TransferRequest(**payload)


# ---------------------------------------------------------------------------
# TransactionResponse
# ---------------------------------------------------------------------------

class TestTransactionResponse:
    def test_accepts_valid_payload_with_iso_timestamp(self):
        resp = TransactionResponse(
            id="TXN-1",
            from_account_id="ACC-1",
            to_account_id="ACC-2",
            amount=25.0,
            type="Transfer",
            timestamp="2026-08-11T12:00:00+00:00",
        )
        assert resp.amount == 25.0
        assert resp.from_account_id == "ACC-1"

    def test_account_ids_are_optional(self):
        resp = TransactionResponse(
            id="TXN-1", amount=25.0, type="Deposit", timestamp="2026-08-11T12:00:00+00:00"
        )
        assert resp.from_account_id is None
        assert resp.to_account_id is None

    def test_rejects_an_unparseable_timestamp(self):
        with pytest.raises(ValidationError):
            TransactionResponse(
                id="TXN-1", amount=25.0, type="Deposit", timestamp="not-a-date"
            )

    def test_requires_amount_type_and_timestamp(self):
        with pytest.raises(ValidationError):
            TransactionResponse(id="TXN-1")


# ---------------------------------------------------------------------------
# TransactionCreate / TransferCreate -- plain models, no extra constraints today
# ---------------------------------------------------------------------------

class TestTransactionCreate:
    def test_accepts_valid_payload(self):
        tc = TransactionCreate(from_account="ACC-1", to_account="ACC-2", amount=10.0, transaction_type="Deposit")
        assert tc.transaction_type == "Deposit"

    def test_from_and_to_account_are_optional(self):
        tc = TransactionCreate(amount=10.0, transaction_type="Deposit")
        assert tc.from_account is None
        assert tc.to_account is None

    def test_requires_amount_and_transaction_type(self):
        with pytest.raises(ValidationError):
            TransactionCreate()


class TestTransferCreate:
    def test_accepts_valid_payload(self):
        tc = TransferCreate(from_account_id="ACC-1", to_account_id="ACC-2", amount=10.0)
        assert tc.amount == 10.0

    @pytest.mark.parametrize("missing_field", ["from_account_id", "to_account_id", "amount"])
    def test_requires_all_fields(self, missing_field):
        payload = {"from_account_id": "ACC-1", "to_account_id": "ACC-2", "amount": 10.0}
        del payload[missing_field]
        with pytest.raises(ValidationError):
            TransferCreate(**payload)


# ---------------------------------------------------------------------------
# CustomerCreate / CustomerUpdate
# ---------------------------------------------------------------------------

class TestCustomerCreate:
    def test_accepts_valid_payload(self):
        c = CustomerCreate(customer_id="CUST-1", name="Alice", email="alice@example.com", branch_id="BR-1")
        assert c.customer_id == "CUST-1"

    @pytest.mark.parametrize(
        "missing_field", ["customer_id", "name", "email", "branch_id"]
    )
    def test_requires_all_fields(self, missing_field):
        payload = {
            "customer_id": "CUST-1",
            "name": "Alice",
            "email": "alice@example.com",
            "branch_id": "BR-1",
        }
        del payload[missing_field]
        with pytest.raises(ValidationError):
            CustomerCreate(**payload)


class TestCustomerUpdate:
    def test_all_fields_are_optional(self):
        update = CustomerUpdate()
        assert update.name is None
        assert update.email is None

    def test_accepts_partial_update(self):
        update = CustomerUpdate(name="Alicia")
        assert update.name == "Alicia"
        assert update.email is None

    def test_note_schema_does_not_enforce_non_blank_strings(self):
        """CustomerUpdate has no validator, so a blank name/email round-trips
        as-is -- customerService.update_customer only checks `is not None`,
        not blankness, so a whitespace-only value reaches the database
        unmodified. Documented here as current behavior, not a guarantee."""
        update = CustomerUpdate(name="   ")
        assert update.name == "   "
