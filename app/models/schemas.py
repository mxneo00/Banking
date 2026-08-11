from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, model_validator

class CustomerCreate(BaseModel):
    customer_id: str
    name: str
    email: str
    branch_id: str

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

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