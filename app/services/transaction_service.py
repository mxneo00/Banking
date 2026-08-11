from typing import List, Optional
from fastapi import HTTPException, status
from models.transaction import Transaction

# Mock data sooo we delete later
_transactions_db = {}
_accounts_db = {
    "ACC-123": {"id": "ACC-123", "balance": 5000.0, "is_active": True},
    "ACC-456": {"id": "ACC-456", "balance": 250.0, "is_active": True},
}

def process_transfer(from_account_id: str, to_account_id: str, amount: float, description: Optional[str]) -> Transaction:
    """Executes business logic for a money transfer."""
    
    from_account = _accounts_db.get(from_account_id)
    to_account = _accounts_db.get(to_account_id)

    # 1. Validation Constraints
    if not from_account or not to_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="One or both accounts not found."
        )
        
    if not from_account["is_active"] or not to_account["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Cannot transfer using inactive accounts."
        )

    if from_account["balance"] < amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Insufficient funds in the origin account."
        )

    # 2. Atomic Execution (The "Transaction Block")
    try:
        from_account["balance"] -= amount
        to_account["balance"] += amount
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="An error occurred while processing the transfer."
        )

    # 3. Create and store the domain entity
    transaction = Transaction(
        from_account_id=from_account_id,
        to_account_id=to_account_id,
        amount=amount,
        description=description
    )
    
    _transactions_db[transaction.transaction_id] = transaction
    return transaction

def list_transactions(start_date: Optional[str] = None, transaction_type: Optional[str] = None) -> List[Transaction]:
    """Retrieves all transactions, applying optional query filters."""
    results = list(_transactions_db.values())

    if transaction_type:
        results = [t for t in results if t.transaction_type == transaction_type.upper()]

    if start_date:
        # Assuming start_date is passed as YYYY-MM-DD
        results = [t for t in results if t.timestamp >= start_date]

    return results

def get_transaction(transaction_id: str) -> Transaction:
    """Fetches a specific transaction by its ID."""
    transaction = _transactions_db.get(transaction_id)
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Transaction '{transaction_id}' not found."
        )
        
    return transaction