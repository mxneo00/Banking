""" Routes for /api/v1/transactions."""

from typing import Optional
from fastapi import APIRouter, status, Query
from models.schemas import TransferRequest
from app.services import transactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

# POST /api/v1/transactions/transfer - Process a money transfer
@router.post("/transfer", status_code=201)
def transfer_money(payload: TransferRequest):
    """Process a money transfer between two accounts and return the serialized record."""
    transaction = transactionService.process_transfer(
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        description=payload.description
    )
    return transaction.to_dict()

# GET /api/v1/transactions - List transactions
@router.get("")
def list_transactions(start_date: Optional[str] = None, transaction_type: Optional[str] = None):
    """Return all transactions, optionally filtered by start date or type."""
    # FastAPI parses the query parameters for us.
    transactions = transactionService.list_transactions(
        start_date=start_date, 
        transaction_type=transaction_type
    )
    return [t.to_dict() for t in transactions]

# GET /api/v1/transactions/{transaction_id} - Get a specific transaction
@router.get("/{transaction_id}")
def get_transaction(transaction_id: str):
    """Fetch a single transaction by ID; raises 404 if not found."""
    return transactionService.get_transaction(transaction_id).to_dict()

# Note: PUT (update) and DELETE (deactivate) are intentionally omitted for 
# transactions to maintain immutable ledger constraints.