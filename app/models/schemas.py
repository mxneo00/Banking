from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field, model_validator

class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Deposit amount must be positive")

class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Withdrawal amount must be positive")

class TransferRequest(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float = Field(..., gt=0, description="Transfer amount must be strictly positive.")
    description: Optional[str] = "Fund Transfer"
    
class TransactionResponse(BaseModel):
    id: str
    from_account_id: Optional[str] = None 
    to_account_id: Optional[str] = None
    amount: float
    type: str  # "Deposit", "Withdrawal", or "Transfer"
    timestamp: datetime
    
class TransactionCreate(BaseModel):
    from_account: Optional[str] = None
    to_account: Optional[str] = None
    amount: float
    transaction_type: str

class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: float


class AccountCreate(BaseModel):
    """Body for POST /api/v1/accounts."""

    customer_id: str = Field(min_length=1)
    account_type: Literal["savings", "checking"]
    opening_balance: float = Field(default=0.0, ge=0)
    # None means "not supplied" so the domain class applies its own default.
    minimum_balance: Optional[float] = Field(default=None, ge=0)
    overdraft_limit: Optional[float] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def reject_mismatched_settings(self):
        if self.account_type == "savings" and self.overdraft_limit is not None:
            raise ValueError("overdraft_limit does not apply to a savings account.")
        if self.account_type == "checking" and self.minimum_balance is not None:
            raise ValueError("minimum_balance does not apply to a checking account.")
        return self