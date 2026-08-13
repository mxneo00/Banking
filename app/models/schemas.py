from typing import Literal, Optional
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

# NOTE: not used by any controller right now -- transactionController uses
# TransactionCreate/TransferRequest below instead. Covered by test_schemas.py
# but not wired into a live endpoint.
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


# ---------------------------------------------------------------------------
# Auth (registration, login, tokens) -- see services/authService.py and
# controllers/authController.py for how these get used.
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    """Body for POST /api/v1/auth/register -- public customer self-signup.

    Creates BOTH a login (UserORM, role=customer) and a bank profile
    (CustomerDB) in one step; there's no separate "customer_id" field here
    because the customer doesn't have one yet -- authService generates it.
    Staff accounts (teller/branch_manager/admin) are never created through
    this endpoint; see StaffCreateRequest below.
    """

    email: str = Field(min_length=1)
    password: str = Field(min_length=8, description="At least 8 characters.")
    name: str = Field(min_length=1)
    branch_id: str = Field(min_length=1)


class StaffCreateRequest(BaseModel):
    """Body for POST /api/v1/auth/staff -- admin-only staff onboarding.

    `role` is restricted to the three staff roles (not "customer") at the
    type level: Pydantic rejects anything else with a 422 before the route
    body even runs.
    """

    email: str = Field(min_length=1)
    password: str = Field(min_length=8, description="At least 8 characters.")
    role: Literal["teller", "branch_manager", "admin"]
    branch_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class TokenResponse(BaseModel):
    """What login/register/refresh return: a fresh pair of tokens.

    `token_type` is always "bearer" -- it tells API clients (and Swagger/
    Postman) how to send the access_token back: as an
    `Authorization: Bearer <access_token>` header.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """Serialized user for responses that include one (e.g. GET /auth/me).
    Deliberately has no password field -- there is nothing to leave out
    accidentally because it was never in this schema to begin with.
    """

    user_id: str
    email: str
    role: str
    customer_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool
    created_at: datetime

class BudgetCreate(BaseModel):
    category: str
    amount: float = Field(..., gt=0, description="Budget amount must be positive")
    period: Literal["weekly", "monthly"]

class BudgetUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0, description="Budget amount must be positive")
    period: Optional[Literal["weekly", "monthly"]] = None