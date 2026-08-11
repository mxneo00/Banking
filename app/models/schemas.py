from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


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