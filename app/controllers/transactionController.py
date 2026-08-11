""" Routes for /api/v1/transactions."""

from typing import Optional
from fastapi import APIRouter, status
from models.schemas import TransactionCreate, TransferRequest
from services import transactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

# POST /api/v1/transactions - Create a raw transaction record
@router.post("", status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate):
    """Record a transaction directly (deposit/withdrawal-style) without the two-account balance movement /transfer does."""
    return transactionService.create_transaction(payload.model_dump())

# POST /api/v1/transactions/transfer - Process a money transfer
@router.post("/transfer", status_code=status.HTTP_201_CREATED)
def transfer_money(payload: TransferRequest):
    """Process a money transfer between two accounts and return the saved record."""
    return transactionService.process_transfer(
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        description=payload.description,
    )

# GET /api/v1/transactions - List transactions
@router.get("")
def get_transactions(start_date: Optional[str] = None, transaction_type: Optional[str] = None):
    """Return all transactions, optionally filtered by start date or type."""
    return transactionService.get_transactions(start_date=start_date, transaction_type=transaction_type)

# GET /api/v1/transactions/{transaction_id} - Get a specific transaction
@router.get("/{transaction_id}")
def get_transaction(transaction_id: str):
    """Fetch a single transaction by ID; raises 404 if not found."""
    return transactionService.get_transaction(transaction_id)

# Note: PUT (update) and DELETE (deactivate) are intentionally omitted for
# transactions to maintain immutable ledger constraints.
