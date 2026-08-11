import uuid
from enum import Enum
from datetime import datetime, timezone
from typing import Optional

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