import uuid
from datetime import datetime, timezone
from typing import Optional

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