import uuid
from enum import Enum
from datetime import datetime, timezone
from typing import Optional

from models.exceptions import DuplicateError, InsufficientFundsError, ValidationError

def require_text(value: Optional[str], error_message: str) -> str:
    """Utility function to ensure a string is not None or empty."""
    if value is None or value.strip() == "":
        raise ValueError(error_message)
    return value

class TransactionType(Enum):
    DEPOSIT = "Deposit"
    WITHDRAWAL = "Withdrawal"
    TRANSFER = "Transfer"

class Transaction:
    """Domain model representing a financial transaction."""
    
    def __init__(
        self, 
        from_account_id: str, 
        to_account_id: str, 
        amount: float, 
        description: Optional[str] = None,
        type: str = "TRANSFER"
    ):
        self.transaction_id = str(uuid.uuid4())
        self.from_account_id = from_account_id
        self.to_account_id = to_account_id
        self.amount = amount
        self.description = description
        self.type = type
        self.status = "COMPLETED"
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        """Serializes the domain object to a dictionary for JSON response."""
        return {
            "transaction_id": self.transaction_id,
            "from_account_id": self.from_account_id,
            "to_account_id": self.to_account_id,
            "amount": self.amount,
            "description": self.description,
            "transaction_type": self.transaction_type,
            "status": self.status,
            "timestamp": self.timestamp
        }

class Customer:
    """Domain model representing a bank customer."""
    
    def __init__(self, customer_id: str, name: str, email: str, branch_id: str):
        self.customer_id = customer_id
        self.name = name
        self.email = email
        self.branch_id = branch_id
        self.is_active = True  # Customers are active by default
        self.__account_numbers = []  # Private list to track associated account numbers

    def add_account(self, account):
        """Associate a new account with this customer."""
        number = require_text(account.account_number, "Account must have a number")
        if number not in self.__account_numbers:
            self.__account_numbers.append(number)

    def update(self, name: Optional[str] = None, email: Optional[str] = None):
        """Update the customer's details; only non-None fields are updated."""
        if name is not None:
            self.name = require_text(name, "Name cannot be empty")
        if email is not None:
            self.email = require_text(email, "Email cannot be empty")

    def deactivate(self):
        """Soft-delete the customer by marking them as inactive."""
        self.is_active = False

    def to_dict(self) -> dict:
        """Serializes the domain object to a dictionary for JSON response."""
        return {
            "customer_id": self.customer_id,
            "name": self.name,
            "email": self.email,
            "branch_id": self.branch_id,
            "is_active": self.is_active,
            "account_numbers": self.__account_numbers
        }

def to_money(value, field_name="amount"):
    """Convert user input into a float rounded to 2 decimal places."""
    if isinstance(value, bool):
        # bool is technically a number in Python, but "True dollars" makes no sense.
        raise ValidationError(f"{field_name} must be a number.")
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be a valid number.")
    return round(amount, 2)


def require_positive(value, field_name="amount"):
    """Return the value as money, rejecting zero and negative amounts."""
    amount = to_money(value, field_name)
    if amount <= 0:
        raise ValidationError(f"{field_name} must be greater than zero.")
    return amount

class Branch:
    """A branch office with one manager, a staff list, and its accounts.

    Assumption for this MVP: the manager is NOT part of the staff list, and
    every branch has exactly one manager. So the staff-to-manager ratio is
    just the staff count divided by 1.
    """

    def __init__(self, branch_code, location, manager_id):
        self.branch_code = require_text(branch_code, "Branch code")
        self.location = require_text(location, "Branch location")
        self.manager_id = require_text(manager_id, "Manager ID")
        self._staff_ids = []
        self._account_numbers = []

    def get_staff_ids(self):
        return list(self._staff_ids)

    def get_account_numbers(self):
        return list(self._account_numbers)

    def get_staff_count(self):
        """Number of staff, excluding the manager."""
        return len(self._staff_ids)

    def add_staff(self, staff_id):
        """Add a staff member; duplicates and the manager are rejected."""
        identifier = require_text(staff_id, "Staff ID")
        if identifier == self.manager_id:
            raise ValidationError(
                f"'{identifier}' is the manager of branch {self.branch_code} "
                "and is not counted as staff."
            )
        if identifier in self._staff_ids:
            raise DuplicateError(
                f"Staff '{identifier}' is already assigned to branch {self.branch_code}."
            )
        self._staff_ids.append(identifier)

    def add_account(self, account_number):
        """Associate an account number with this branch, ignoring repeats."""
        number = require_text(account_number, "Account number")
        if number not in self._account_numbers:
            self._account_numbers.append(number)

    def staff_to_manager_ratio(self):
        """Staff per manager. One manager per branch, so this is the staff count."""
        managers = 1
        return len(self._staff_ids) / managers

    def describe(self):
        return (
            f"{self.branch_code} | {self.location} | manager {self.manager_id} | "
            f"staff {self.get_staff_count()} | accounts {len(self._account_numbers)} | "
            f"ratio {self.staff_to_manager_ratio():.1f}"
        )

    def __str__(self):
        return self.describe()

class Account:
    """Base account. Owns the balance and the rules for changing it.

    ENCAPSULATION: `_balance` is "private" by convention (the leading
    underscore). The only ways to change it are `deposit` and `withdraw`,
    which validate the amount first.
    """

    account_type = "Account"

    def __init__(self, account_number, customer_id, branch_code, opening_balance=0.0):
        self.account_number = require_text(account_number, "Account number is required and cannot be empty.")
        self.customer_id = require_text(customer_id, "Customer ID is required and cannot be empty.")
        self.branch_code = require_text(branch_code, "Branch code is required and cannot be empty.")

        balance = to_money(opening_balance, "Opening balance")
        if balance < 0:
            raise ValidationError("Opening balance cannot be negative.")
        self._balance = balance
        self._transactions = []

    def get_balance(self):
        """Read-only view of the balance (there's no set_balance method)."""
        return self._balance

    def get_transactions(self):
        return list(self._transactions)

    def can_withdraw(self, amount):
        """The overridable withdrawal rule.

        POLYMORPHISM: callers always call `can_withdraw` and never ask what
        kind of account they hold. Savings and Checking each answer differently.
        """
        return to_money(amount) <= self._balance

    def deposit(self, amount):
        """Add money after validating it. Returns the new balance."""
        value = require_positive(amount, "Deposit amount")
        self._balance = round(self._balance + value, 2)
        return self._balance

    def withdraw(self, amount):
        """Remove money if this account's own rule allows it."""
        value = require_positive(amount, "Withdrawal amount")
        if not self.can_withdraw(value):
            raise InsufficientFundsError(self.rejection_reason(value))
        self._balance = round(self._balance - value, 2)
        return self._balance

    def rejection_reason(self, amount):
        """Message shown when can_withdraw says no. Subclasses refine it."""
        return (
            f"Account {self.account_number} has {self._balance} available; "
            f"cannot withdraw {amount}."
        )

    def record(self, transaction):
        """Store a transaction in this account's history."""
        self._transactions.append(transaction)

    def to_dict(self) -> dict:
        """Serializes the domain object to a dictionary for JSON response."""
        return {
            "account_number": self.account_number,
            "account_type": self.account_type,
            "customer_id": self.customer_id,
            "branch_code": self.branch_code,
            "balance": self._balance,
        }

    def describe(self):
        """Readable one-line summary, extended by each subclass."""
        return (
            f"[{self.account_type}] {self.account_number} | owner {self.customer_id} | "
            f"branch {self.branch_code} | balance {self._balance}"
        )

    def __str__(self):
        return self.describe()


class SavingsAccount(Account):
    """INHERITANCE: reuses everything in Account, adds a minimum balance."""

    account_type = "Savings"

    def __init__(self, account_number, customer_id, branch_code,
                 opening_balance=0.0, minimum_balance=100.0):
        super().__init__(account_number, customer_id, branch_code, opening_balance)
        minimum = to_money(minimum_balance, "Minimum balance")
        if minimum < 0:
            raise ValidationError("Minimum balance cannot be negative.")
        self.minimum_balance = minimum

    def can_withdraw(self, amount):
        """A savings withdrawal must leave at least the minimum balance."""
        value = to_money(amount)
        return self._balance - value >= self.minimum_balance

    def rejection_reason(self, amount):
        available = round(self._balance - self.minimum_balance, 2)
        return (
            f"Savings account {self.account_number} must keep a minimum balance of "
            f"{self.minimum_balance}. Only {available} of {self._balance} is "
            f"available, so {amount} cannot be withdrawn."
        )

    def to_dict(self) -> dict:
        data = super().to_dict()
        data["minimum_balance"] = self.minimum_balance
        return data

    def describe(self):
        return f"{super().describe()} | minimum balance {self.minimum_balance}"


class CheckingAccount(Account):
    """INHERITANCE: reuses everything in Account, adds an overdraft limit."""

    account_type = "Checking"

    def __init__(self, account_number, customer_id, branch_code,
                 opening_balance=0.0, overdraft_limit=500.0):
        super().__init__(account_number, customer_id, branch_code, opening_balance)
        limit = to_money(overdraft_limit, "Overdraft limit")
        if limit < 0:
            raise ValidationError("Overdraft limit cannot be negative.")
        self.overdraft_limit = limit

    def can_withdraw(self, amount):
        """The balance may go negative, but never past the overdraft limit."""
        value = to_money(amount)
        return self._balance - value >= -self.overdraft_limit

    def rejection_reason(self, amount):
        available = round(self._balance + self.overdraft_limit, 2)
        return (
            f"Checking account {self.account_number} allows an overdraft of "
            f"{self.overdraft_limit}. Only {available} is available, so {amount} "
            f"cannot be withdrawn."
        )

    def to_dict(self) -> dict:
        data = super().to_dict()
        data["overdraft_limit"] = self.overdraft_limit
        return data

    def describe(self):
        return f"{super().describe()} | overdraft limit {self.overdraft_limit}"


class Branch:
    """A branch office with one manager, a staff list, and its accounts.

    Assumption for this MVP: the manager is NOT part of the staff list, and
    every branch has exactly one manager. So the staff-to-manager ratio is
    just the staff count divided by 1.
    """

    def __init__(self, branch_code, location, manager_id):
        self.branch_code = require_text(branch_code, "Branch code")
        self.location = require_text(location, "Branch location")
        self.manager_id = require_text(manager_id, "Manager ID")
        self._staff_ids = []
        self._account_numbers = []

    def get_staff_ids(self):
        return list(self._staff_ids)

    def get_account_numbers(self):
        return list(self._account_numbers)

    def get_staff_count(self):
        """Number of staff, excluding the manager."""
        return len(self._staff_ids)

    def add_staff(self, staff_id):
        """Add a staff member; duplicates and the manager are rejected."""
        identifier = require_text(staff_id, "Staff ID")
        if identifier == self.manager_id:
            raise ValidationError(
                f"'{identifier}' is the manager of branch {self.branch_code} "
                "and is not counted as staff."
            )
        if identifier in self._staff_ids:
            raise DuplicateError(
                f"Staff '{identifier}' is already assigned to branch {self.branch_code}."
            )
        self._staff_ids.append(identifier)

    def add_account(self, account_number):
        """Associate an account number with this branch, ignoring repeats."""
        number = require_text(account_number, "Account number")
        if number not in self._account_numbers:
            self._account_numbers.append(number)

    def staff_to_manager_ratio(self):
        """Staff per manager. One manager per branch, so this is the staff count."""
        managers = 1
        return len(self._staff_ids) / managers

    def describe(self):
        return (
            f"{self.branch_code} | {self.location} | manager {self.manager_id} | "
            f"staff {self.get_staff_count()} | accounts {len(self._account_numbers)} | "
            f"ratio {self.staff_to_manager_ratio():.1f}"
        )

    def __str__(self):
        return self.describe()