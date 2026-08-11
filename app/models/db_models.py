"""SQLAlchemy ORM models for Postgres persistence."""

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AccountModel(Base):
    """Minimal accounts table for the first Postgres slice."""

    __tablename__ = "accounts"

    account_number: Mapped[str] = mapped_column(String(32), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    account_type: Mapped[str] = mapped_column(String(16), nullable=False)
    balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    minimum_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    overdraft_limit: Mapped[float | None] = mapped_column(Float, nullable=True)
    branch_code: Mapped[str] = mapped_column(String(32), nullable=False, default="BR001")

    def to_dict(self) -> dict:
        data = {
            "account_number": self.account_number,
            "customer_id": self.customer_id,
            "account_type": self.account_type,
            "balance": self.balance,
            "branch_code": self.branch_code,
        }
        if self.minimum_balance is not None:
            data["minimum_balance"] = self.minimum_balance
        if self.overdraft_limit is not None:
            data["overdraft_limit"] = self.overdraft_limit
        return data
