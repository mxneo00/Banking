"""Tests for app/services/transactionService.py.

These hit the real Postgres database (see conftest.py's autouse fixture) --
transactionService talks to models/database.py's SessionLocal directly, so
there's no in-memory mock to swap in for this slice. `docker compose up -d
db` must be running before these tests execute.
"""

import pytest
from fastapi import HTTPException

import services.transactionService as transactionService
from models.database import Account as AccountORM, SessionLocal


def _balance(account_number):
    with SessionLocal() as session:
        return session.get(AccountORM, account_number).balance


class TestCreateTransactionDeposit:
    def test_credits_the_account(self):
        result = transactionService.create_transaction({
            "to_account": "ACC-123", "amount": 100.0, "transaction_type": "Deposit",
        })
        assert result["type"] == "Deposit"
        assert result["to_account_id"] == "ACC-123"
        assert result["from_account_id"] is None
        assert result["amount"] == 100.0
        assert _balance("ACC-123") == 5100.0

    def test_requires_to_account(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({"amount": 100.0, "transaction_type": "Deposit"})
        assert exc_info.value.status_code == 400

    def test_rejects_a_from_account(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "from_account": "ACC-123", "to_account": "ACC-456",
                "amount": 100.0, "transaction_type": "Deposit",
            })
        assert exc_info.value.status_code == 400

    def test_raises_404_for_an_unknown_account(self):
        # to_account_id is a real foreign key onto accounts, so this is
        # caught with a clean 404 rather than a raw DB IntegrityError.
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "to_account": "NO-SUCH-ACC", "amount": 5.0, "transaction_type": "Deposit",
            })
        assert exc_info.value.status_code == 404


class TestCreateTransactionWithdrawal:
    def test_debits_the_account(self):
        result = transactionService.create_transaction({
            "from_account": "ACC-123", "amount": 100.0, "transaction_type": "Withdrawal",
        })
        assert result["type"] == "Withdrawal"
        assert result["from_account_id"] == "ACC-123"
        assert result["to_account_id"] is None
        assert _balance("ACC-123") == 4900.0

    def test_requires_from_account(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({"amount": 100.0, "transaction_type": "Withdrawal"})
        assert exc_info.value.status_code == 400

    def test_rejects_a_to_account(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "from_account": "ACC-123", "to_account": "ACC-456",
                "amount": 100.0, "transaction_type": "Withdrawal",
            })
        assert exc_info.value.status_code == 400

    def test_rejects_insufficient_funds(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "from_account": "ACC-456", "amount": 99999.0, "transaction_type": "Withdrawal",
            })
        assert exc_info.value.status_code == 400
        assert _balance("ACC-456") == 250.0

    def test_allows_withdrawal_into_overdraft(self):
        # ACC-456: balance 250, overdraft_limit 500 -> up to 750 available.
        result = transactionService.create_transaction({
            "from_account": "ACC-456", "amount": 400.0, "transaction_type": "Withdrawal",
        })
        assert result["type"] == "Withdrawal"
        assert _balance("ACC-456") == -150.0

    def test_rejects_withdrawal_past_overdraft_limit(self):
        # Available = 250 + 500 = 750; 751 must fail.
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "from_account": "ACC-456", "amount": 751.0, "transaction_type": "Withdrawal",
            })
        assert exc_info.value.status_code == 400
        assert _balance("ACC-456") == 250.0


class TestCreateTransactionTransfer:
    def test_delegates_to_process_transfer(self):
        result = transactionService.create_transaction({
            "from_account": "ACC-123", "to_account": "ACC-456",
            "amount": 100.0, "transaction_type": "Transfer",
        })
        assert result["type"] == "Transfer"
        assert _balance("ACC-123") == 4900.0
        assert _balance("ACC-456") == 350.0

    def test_requires_both_accounts(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "from_account": "ACC-123", "amount": 100.0, "transaction_type": "Transfer",
            })
        assert exc_info.value.status_code == 400


class TestCreateTransactionValidation:
    def test_rejects_invalid_transaction_type(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "to_account": "ACC-123", "amount": 100.0, "transaction_type": "Bogus",
            })
        assert exc_info.value.status_code == 400

    def test_rejects_non_positive_amount(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.create_transaction({
                "to_account": "ACC-123", "amount": 0, "transaction_type": "Deposit",
            })
        assert exc_info.value.status_code == 400


class TestProcessTransfer:
    def test_moves_funds_between_accounts(self):
        transactionService.process_transfer("ACC-123", "ACC-456", 100.0, "rent")
        assert _balance("ACC-123") == 4900.0
        assert _balance("ACC-456") == 350.0

    def test_returns_a_transfer_transaction(self):
        txn = transactionService.process_transfer("ACC-123", "ACC-456", 100.0, "rent")
        assert txn["from_account_id"] == "ACC-123"
        assert txn["to_account_id"] == "ACC-456"
        assert txn["amount"] == 100.0
        assert txn["description"] == "rent"
        assert txn["type"] == "Transfer"

    def test_raises_404_when_source_account_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.process_transfer("NO-SUCH-ACC", "ACC-456", 100.0)
        assert exc_info.value.status_code == 404

    def test_raises_404_when_destination_account_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.process_transfer("ACC-123", "NO-SUCH-ACC", 100.0)
        assert exc_info.value.status_code == 404

    def test_raises_400_on_insufficient_funds(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.process_transfer("ACC-456", "ACC-123", 99999.0)
        assert exc_info.value.status_code == 400

    def test_allows_transfer_into_overdraft(self):
        # ACC-456 can go to -150 (250 - 400) within its 500 overdraft.
        txn = transactionService.process_transfer("ACC-456", "ACC-123", 400.0)
        assert txn["type"] == "Transfer"
        assert _balance("ACC-456") == -150.0
        assert _balance("ACC-123") == 5400.0

    def test_rejects_transfer_past_overdraft_limit(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.process_transfer("ACC-456", "ACC-123", 751.0)
        assert exc_info.value.status_code == 400
        assert _balance("ACC-456") == 250.0
        assert _balance("ACC-123") == 5000.0

    def test_insufficient_funds_does_not_record_a_transaction_or_move_balances(self):
        try:
            transactionService.process_transfer("ACC-456", "ACC-123", 99999.0)
        except HTTPException:
            pass
        assert transactionService.get_transactions() == []
        assert _balance("ACC-456") == 250.0
        assert _balance("ACC-123") == 5000.0

    def test_rejects_transfer_to_the_same_account(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.process_transfer("ACC-123", "ACC-123", 10.0)
        assert exc_info.value.status_code == 400

    def test_rejects_non_positive_amount(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.process_transfer("ACC-123", "ACC-456", 0)
        assert exc_info.value.status_code == 400


class TestGetTransaction:
    def test_returns_the_stored_transaction(self):
        created = transactionService.process_transfer("ACC-123", "ACC-456", 50.0)
        fetched = transactionService.get_transaction(created["transaction_id"])
        assert fetched["transaction_id"] == created["transaction_id"]

    def test_raises_404_for_unknown_id(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.get_transaction("does-not-exist")
        assert exc_info.value.status_code == 404


class TestGetTransactions:
    def test_returns_empty_list_when_no_transactions(self):
        assert transactionService.get_transactions() == []

    def test_returns_all_transactions_when_unfiltered(self):
        t1 = transactionService.process_transfer("ACC-123", "ACC-456", 10.0)
        t2 = transactionService.process_transfer("ACC-456", "ACC-123", 5.0)

        results = transactionService.get_transactions()
        assert {t["transaction_id"] for t in results} == {t1["transaction_id"], t2["transaction_id"]}

    def test_filters_by_type(self):
        transactionService.process_transfer("ACC-123", "ACC-456", 10.0)
        transactionService.create_transaction({
            "to_account": "ACC-123", "amount": 20.0, "transaction_type": "Deposit",
        })

        results = transactionService.get_transactions(transaction_type="Deposit")
        assert len(results) == 1
        assert results[0]["type"] == "Deposit"

    def test_filters_by_start_date(self):
        transactionService.process_transfer("ACC-123", "ACC-456", 10.0)

        assert transactionService.get_transactions(start_date="9999-01-01") == []

    def test_rejects_a_malformed_start_date(self):
        with pytest.raises(HTTPException) as exc_info:
            transactionService.get_transactions(start_date="not-a-date")
        assert exc_info.value.status_code == 400
