"""
    Routes for budget management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
 
from models.database import UserORM, get_db
from models.schemas import BudgetCreate, BudgetUpdate
from security.dependencies import get_current_user
from services import budgetService
 
router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])
 
 
def _require_customer_id(current_user: UserORM) -> str:
    if not current_user.customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Budgets are a customer feature -- staff logins don't have their own budget list.",
        )
    return current_user.customer_id
 
 
@router.post("", status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Add a new category spending limit for the logged-in customer."""
    customer_id = _require_customer_id(current_user)
    return budgetService.create_budget(
        db, customer_id, category=payload.category, amount=payload.amount, period=payload.period
    )
 
 
@router.get("")
def list_budgets(
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """List every budget belonging to the logged-in customer."""
    customer_id = _require_customer_id(current_user)
    return budgetService.list_budgets(db, customer_id)
 
 
@router.put("/{budget_id}")
def update_budget(
    budget_id: str,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Update one of the logged-in customer's own budgets."""
    customer_id = _require_customer_id(current_user)
    return budgetService.update_budget(
        db, customer_id, budget_id,
        category=payload.category, amount=payload.amount, period=payload.period,
    )
 
 
@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Delete one of the logged-in customer's own budgets."""
    customer_id = _require_customer_id(current_user)
    budgetService.delete_budget(db, customer_id, budget_id)