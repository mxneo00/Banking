"""The Bank coordinator.

ABSTRACTION: the console application calls high-level operations such as
bank.transfer(...) and never touches an account balance or a transaction
list directly. Everything below is the only place that knows how the pieces
of the domain fit together.
"""

from app.models.exceptions import (
    BankingError,
    DuplicateError,
    InsufficientFundsError,
    NotFoundError,
    ValidationError,
)
from models import (
    Account,
    Branch,
    CheckingAccount,
    Customer,
    SavingsAccount,
    Transaction,
    require_positive,
    require_text,
    to_money,
)

MIN_YEAR = 1900
MAX_YEAR = 2200


class Bank:
    """Holds every branch, customer, account, and transaction in memory."""

    def __init__(self, name="MVP Bank"):
        self.name = require_text(name, "Bank name")
        self._branches = {}
        self._customers = {}
        self._accounts = {}
        self._transactions = []
        self._next_account_number = 1001
        self._next_transaction_number = 1

    # ------------------------------------------------------------------
    # Read-only views
    # ------------------------------------------------------------------
    def get_branches(self):
        return list(self._branches.values())

    def get_customers(self):
        return list(self._customers.values())

    def get_accounts(self):
        return list(self._accounts.values())

    def get_transactions(self):
        return list(self._transactions)

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    def add_branch(self, branch):
        """Register a branch, rejecting a duplicate branch code."""
        if not isinstance(branch, Branch):
            raise ValidationError("add_branch expects a Branch object.")
        if branch.branch_code in self._branches:
            raise DuplicateError(
                f"Branch code '{branch.branch_code}' is already registered."
            )
        self._branches[branch.branch_code] = branch
        return branch

    def add_customer(self, customer):
        """Register a customer, rejecting a duplicate id or unknown branch."""
        if not isinstance(customer, Customer):
            raise ValidationError("add_customer expects a Customer object.")
        if customer.customer_id in self._customers:
            raise DuplicateError(
                f"Customer ID '{customer.customer_id}' is already registered."
            )
        if customer.branch_id not in self._branches:
            raise NotFoundError(f"Branch '{customer.branch_id}' does not exist.")
        self._customers[customer.customer_id] = customer
        return customer

    def get_branch(self, branch_code):
        code = require_text(branch_code, "Branch code")
        if code not in self._branches:
            raise NotFoundError(f"Branch '{code}' does not exist.")
        return self._branches[code]

    def get_customer(self, customer_id):
        identifier = require_text(customer_id, "Customer ID")
        if identifier not in self._customers:
            raise NotFoundError(f"Customer '{identifier}' does not exist.")
        return self._customers[identifier]

    def get_account(self, account_number):
        number = require_text(account_number, "Account number")
        if number not in self._accounts:
            raise NotFoundError(f"Account '{number}' does not exist.")
        return self._accounts[number]

    def add_staff(self, branch_code, staff_id):
        """Convenience wrapper so the console never touches Branch internals."""
        branch = self.get_branch(branch_code)
        branch.add_staff(staff_id)
        return branch

    # ------------------------------------------------------------------
    # Opening accounts
    # ------------------------------------------------------------------
    def open_savings_account(self, customer_id, opening_balance=0.0,
                              minimum_balance=100.0, account_number=None):
        """Open a savings account for an existing customer."""
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
        """Open a checking account for an existing customer."""
        customer = self.get_customer(customer_id)
        branch = self.get_branch(customer.branch_id)
        number = self._claim_account_number(account_number)
        account = CheckingAccount(
            account_number=number,
            customer_id=customer.customer_id,
            branch_code=branch.branch_code,
            opening_balance=opening_balance,
            overdraft_limit=overdraft_limit,
        )
        self._register_account(account, customer, branch)
        return account

    # ------------------------------------------------------------------
    # Money operations
    # ------------------------------------------------------------------
    def deposit(self, account_number, amount):
        """Deposit money and record the transaction once it succeeds."""
        account = self.get_account(account_number)
        value = require_positive(amount, "Deposit amount")
        account.deposit(value)
        return self._record("DEPOSIT", value, destination=account, accounts=(account,))

    def withdraw(self, account_number, amount):
        """Withdraw money if the account's own rule allows it."""
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

    # ------------------------------------------------------------------
    # Queries and reports
    # ------------------------------------------------------------------
    def accounts_for_branch(self, branch_code):
        """Every account belonging to a branch (empty list is a valid answer)."""
        branch = self.get_branch(branch_code)
        return [
            self._accounts[number]
            for number in branch.get_account_numbers()
            if number in self._accounts
        ]

    def accounts_for_customer(self, customer_id):
        customer = self.get_customer(customer_id)
        return [
            self._accounts[number]
            for number in customer.get_account_numbers()
            if number in self._accounts
        ]

    def monthly_transaction_volume(self, branch_code, year, month):
        """Total value of transactions touching a branch in one month.

        Rules used consistently here:
        * A transaction counts when at least one participating account belongs
          to the branch.
        * Each transaction counts once for that branch, even if both sides of a
          transfer are branch accounts.
        * Transaction amounts are summed, never resulting balances.
        * A transfer between two branches counts once for each of them.
        """
        branch = self.get_branch(branch_code)
        year = self._validate_year(year)
        month = self._validate_month(month)

        branch_accounts = set(branch.get_account_numbers())
        total = 0.0
        for transaction in self._transactions:
            stamp = transaction.timestamp
            if stamp.year != year or stamp.month != month:
                continue
            participants = {transaction.source_account, transaction.destination_account}
            participants.discard(None)
            if participants & branch_accounts:
                total += transaction.amount
        return round(total, 2)

    def branches_above_ratio(self, limit):
        """Branches whose staff-to-manager ratio is strictly above `limit`."""
        if isinstance(limit, bool) or not isinstance(limit, (int, float)):
            raise ValidationError("Ratio limit must be a number.")
        if limit < 0:
            raise ValidationError("Ratio limit cannot be negative.")
        return [
            branch
            for branch in self._branches.values()
            if branch.staff_to_manager_ratio() > limit
        ]

    def transactions_for_account(self, account_number):
        return self.get_account(account_number).get_transactions()

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
        """Build the transaction and file it with the bank and each account."""
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

    @staticmethod
    def _validate_year(year):
        if isinstance(year, bool) or not isinstance(year, int):
            raise ValidationError("Year must be a whole number.")
        if not MIN_YEAR <= year <= MAX_YEAR:
            raise ValidationError(
                f"Year must be between {MIN_YEAR} and {MAX_YEAR}, got {year}."
            )
        return year

    @staticmethod
    def _validate_month(month):
        if isinstance(month, bool) or not isinstance(month, int):
            raise ValidationError("Month must be a whole number.")
        if not 1 <= month <= 12:
            raise ValidationError(f"Month must be between 1 and 12, got {month}.")
        return month
