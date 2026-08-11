"""In-memory repository (the Repository/Data layer).

Holds every branch, customer, account, and transaction in memory and
exposes simple storage operations: add, get, list. It does NOT contain
business rules like "is this account type valid" or "is this customer
still active" — that belongs in the services layer. This class only knows
how to store and retrieve domain objects.

In a real system this file is what you'd replace with SQLAlchemy models
and actual database queries — everything above it (services, controllers)
would stay the same, because they only ever call methods like
`get_customer(id)`, not raw SQL.
"""

from models.domain import (
    CheckingAccount,
    SavingsAccount,
    Transaction,
    require_positive,
    require_text,
    to_money,
)
from models.exceptions import (
    BankingError,
    DuplicateError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)


class BankRepository:
    """Holds all data for the API in plain Python dictionaries and lists."""

    def __init__(self):
        self._branches = {}
        self._customers = {}
        self._accounts = {}
        self._transactions = []
        self._next_account_number = 1001
        self._next_transaction_number = 1

    # ------------------------------------------------------------------
    # Branches
    # ------------------------------------------------------------------
    def add_branch(self, branch):
        if branch.branch_code in self._branches:
            raise DuplicateError(
                f"Branch code '{branch.branch_code}' is already registered."
            )
        self._branches[branch.branch_code] = branch
        return branch

    def get_branches(self):
        return list(self._branches.values())

    def get_branch(self, branch_code):
        code = require_text(branch_code, "Branch code")
        if code not in self._branches:
            raise NotFoundError(f"Branch '{code}' does not exist.")
        return self._branches[code]

    # ------------------------------------------------------------------
    # Customers
    # ------------------------------------------------------------------
    def add_customer(self, customer):
        if customer.customer_id in self._customers:
            raise DuplicateError(
                f"Customer ID '{customer.customer_id}' is already registered."
            )
        if customer.branch_id not in self._branches:
            raise NotFoundError(f"Branch '{customer.branch_id}' does not exist.")
        self._customers[customer.customer_id] = customer
        return customer

    def get_customers(self):
        return list(self._customers.values())

    def get_customer(self, customer_id):
        identifier = require_text(customer_id, "Customer ID")
        if identifier not in self._customers:
            raise NotFoundError(f"Customer '{identifier}' does not exist.")
        return self._customers[identifier]

    # ------------------------------------------------------------------
    # Accounts
    # ------------------------------------------------------------------
    def open_savings_account(self, customer_id, opening_balance=0.0,
                              minimum_balance=100.0, account_number=None):
        customer = self.get_customer(customer_id)
        branch = self.get_branch(customer.branch_id)
        number = self._claim_account_number(account_number)
        account = SavingsAccount(
            number, customer.customer_id, branch.branch_code,
            opening_balance, minimum_balance,
        )
        self._register_account(account, customer, branch)
        return account

    def open_checking_account(self, customer_id, opening_balance=0.0,
                               overdraft_limit=500.0, account_number=None):
        customer = self.get_customer(customer_id)
        branch = self.get_branch(customer.branch_id)
        number = self._claim_account_number(account_number)
        account = CheckingAccount(
            number, customer.customer_id, branch.branch_code,
            opening_balance, overdraft_limit,
        )
        self._register_account(account, customer, branch)
        return account

    def get_accounts(self):
        return list(self._accounts.values())

    def get_account(self, account_number):
        number = require_text(account_number, "Account number")
        if number not in self._accounts:
            raise NotFoundError(f"Account '{number}' does not exist.")
        return self._accounts[number]

    # ------------------------------------------------------------------
    # Money movement
    # ------------------------------------------------------------------
    def deposit(self, account_number, amount):
        account = self.get_account(account_number)
        value = require_positive(amount, "Deposit amount")
        account.deposit(value)
        return self._record("DEPOSIT", value, destination=account, accounts=(account,))

    def withdraw(self, account_number, amount):
        account = self.get_account(account_number)
        value = require_positive(amount, "Withdrawal amount")
        account.withdraw(value)  # raises InsufficientFundsError before anything is recorded
        return self._record("WITHDRAWAL", value, source=account, accounts=(account,))

    def transfer(self, source_account_number, destination_account_number, amount):
        """Move money between two accounts as a single all-or-nothing step."""
        source = self.get_account(source_account_number)
        destination = self.get_account(destination_account_number)
        if source.account_number == destination.account_number:
            raise ValidationError("Cannot transfer money to the same account.")
        value = require_positive(amount, "Transfer amount")

        if not source.can_withdraw(value):
            raise InsufficientFundsError(source.rejection_reason(value))
        source.withdraw(value)
        try:
            destination.deposit(value)
        except BankingError:
            # Put the money back so a failed transfer changes nothing.
            source.deposit(value)
            raise
        return self._record(
            "TRANSFER", value, source=source, destination=destination,
            accounts=(source, destination),
        )

    def get_transactions(self):
        return list(self._transactions)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _claim_account_number(self, account_number):
        """Reserve a unique account number, generating one when not supplied."""
        if account_number is None:
            number = f"AC{self._next_account_number}"
            while number in self._accounts:
                self._next_account_number += 1
                number = f"AC{self._next_account_number}"
            self._next_account_number += 1
            return number

        number = require_text(account_number, "Account number")
        if number in self._accounts:
            raise DuplicateError(f"Account number '{number}' is already in use.")
        return number

    def _register_account(self, account, customer, branch):
        if account.account_number in self._accounts:
            raise DuplicateError(
                f"Account number '{account.account_number}' is already in use."
            )
        self._accounts[account.account_number] = account
        customer.add_account(account.account_number)
        branch.add_account(account.account_number)

    def _record(self, tx_type, amount, source=None, destination=None, accounts=()):
        transaction_id = f"TX{self._next_transaction_number:04d}"
        self._next_transaction_number += 1
        transaction = Transaction(
            transaction_id=transaction_id,
            tx_type=tx_type,
            amount=to_money(amount),
            source_account=source.account_number if source else None,
            destination_account=destination.account_number if destination else None,
        )
        self._transactions.append(transaction)
        for account in accounts:
            account.record(transaction)
        return transaction


# A single shared instance. Every service module imports this same object,
# so every request sees the same in-memory data. This stands in for a
# real database connection/session in a production app — swapping it for
# one later would not require changing the services or controllers.
repository = BankRepository()
