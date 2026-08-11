"""Tests for app/models/domain.py -- Transaction, Customer, require_text, TransactionType."""

import uuid
from types import SimpleNamespace

import pytest

from models.domain import Customer, Transaction, TransactionType, require_text


# ---------------------------------------------------------------------------
# require_text
# ---------------------------------------------------------------------------

class TestRequireText:
    def test_returns_value_when_non_empty(self):
        assert require_text("Alice", "should not raise") == "Alice"

    def test_raises_on_none(self):
        with pytest.raises(ValueError, match="cannot be blank"):
            require_text(None, "cannot be blank")

    def test_raises_on_empty_string(self):
        with pytest.raises(ValueError, match="cannot be blank"):
            require_text("", "cannot be blank")

    def test_raises_on_whitespace_only_string(self):
        with pytest.raises(ValueError, match="cannot be blank"):
            require_text("   ", "cannot be blank")

    def test_does_not_strip_the_returned_value(self):
        # require_text validates via a stripped copy but returns the original.
        assert require_text("  Alice  ", "err") == "  Alice  "


# ---------------------------------------------------------------------------
# TransactionType
# ---------------------------------------------------------------------------

class TestTransactionType:
    @pytest.mark.parametrize(
        "member, expected_value",
        [
            (TransactionType.DEPOSIT, "Deposit"),
            (TransactionType.WITHDRAWAL, "Withdrawal"),
            (TransactionType.TRANSFER, "Transfer"),
        ],
    )
    def test_member_values(self, member, expected_value):
        assert member.value == expected_value


# ---------------------------------------------------------------------------
# Transaction
# ---------------------------------------------------------------------------

class TestTransactionConstruction:
    def test_generates_a_unique_uuid_transaction_id(self):
        t1 = Transaction("ACC-1", "ACC-2", 100.0)
        t2 = Transaction("ACC-1", "ACC-2", 100.0)
        assert t1.transaction_id != t2.transaction_id
        # transaction_id must be a valid uuid4 string
        uuid.UUID(t1.transaction_id, version=4)

    def test_stores_core_fields(self):
        t = Transaction("ACC-1", "ACC-2", 250.5, description="rent")
        assert t.from_account_id == "ACC-1"
        assert t.to_account_id == "ACC-2"
        assert t.amount == 250.5
        assert t.description == "rent"

    def test_description_defaults_to_none(self):
        t = Transaction("ACC-1", "ACC-2", 10.0)
        assert t.description is None

    def test_type_defaults_to_transfer(self):
        t = Transaction("ACC-1", "ACC-2", 10.0)
        assert t.type == "TRANSFER"

    def test_type_can_be_overridden(self):
        t = Transaction("ACC-1", "ACC-2", 10.0, type="DEPOSIT")
        assert t.type == "DEPOSIT"

    def test_status_defaults_to_completed(self):
        t = Transaction("ACC-1", "ACC-2", 10.0)
        assert t.status == "COMPLETED"

    def test_timestamp_is_an_iso_string(self):
        from datetime import datetime

        t = Transaction("ACC-1", "ACC-2", 10.0)
        # Should round-trip through fromisoformat without raising.
        datetime.fromisoformat(t.timestamp)


class TestTransactionToDict:
    def test_to_dict_raises_because_transaction_type_attribute_is_never_set(self):
        """Known bug: Transaction.__init__ stores the type on self.type, but
        to_dict() reads self.transaction_type, which is never assigned.
        Calling to_dict() on any Transaction currently raises AttributeError.
        See app/models/domain.py to_dict() and __init__().
        """
        t = Transaction("ACC-1", "ACC-2", 10.0)
        with pytest.raises(AttributeError, match="transaction_type"):
            t.to_dict()


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class TestCustomerConstruction:
    def test_stores_core_fields(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        assert c.customer_id == "CUST-1"
        assert c.name == "Alice"
        assert c.email == "alice@example.com"
        assert c.branch_id == "BR-1"

    def test_is_active_by_default(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        assert c.is_active is True

    def test_starts_with_no_accounts(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        assert c.to_dict()["account_numbers"] == []


class TestCustomerAddAccount:
    def test_adds_account_number(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        account = SimpleNamespace(account_number="ACC-100")
        c.add_account(account)
        assert c.to_dict()["account_numbers"] == ["ACC-100"]

    def test_does_not_duplicate_account_number(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        account = SimpleNamespace(account_number="ACC-100")
        c.add_account(account)
        c.add_account(account)
        assert c.to_dict()["account_numbers"] == ["ACC-100"]

    def test_raises_when_account_has_no_number(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        account = SimpleNamespace(account_number=None)
        with pytest.raises(ValueError, match="Account must have a number"):
            c.add_account(account)


class TestCustomerUpdate:
    def test_updates_name_only(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        c.update(name="Alicia")
        assert c.name == "Alicia"
        assert c.email == "alice@example.com"

    def test_updates_email_only(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        c.update(email="new@example.com")
        assert c.email == "new@example.com"
        assert c.name == "Alice"

    def test_no_args_leaves_fields_unchanged(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        c.update()
        assert c.name == "Alice"
        assert c.email == "alice@example.com"

    def test_rejects_empty_name(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        with pytest.raises(ValueError, match="Name cannot be empty"):
            c.update(name="   ")

    def test_rejects_empty_email(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        with pytest.raises(ValueError, match="Email cannot be empty"):
            c.update(email="")


class TestCustomerDeactivate:
    def test_marks_customer_inactive(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        c.deactivate()
        assert c.is_active is False

    def test_is_idempotent(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        c.deactivate()
        c.deactivate()
        assert c.is_active is False


class TestCustomerToDict:
    def test_serializes_all_fields(self):
        c = Customer("CUST-1", "Alice", "alice@example.com", "BR-1")
        c.add_account(SimpleNamespace(account_number="ACC-100"))
        c.deactivate()

        assert c.to_dict() == {
            "customer_id": "CUST-1",
            "name": "Alice",
            "email": "alice@example.com",
            "branch_id": "BR-1",
            "is_active": False,
            "account_numbers": ["ACC-100"],
        }
