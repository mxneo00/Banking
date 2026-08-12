"""
    Business logic for budget management, including creating, retrieving, updating, and deleting budgets.
"""

import uuid
from datetime import datetime, timezone
 
from sqlalchemy.orm import Session
 
from models.database import BudgetORM
from models.exceptions import NotFoundError
 
def _serialize(budget: BudgetORM) -> dict:
    return {
        "id": budget.id,
        "customer_id": budget.customer_id,
        "category": budget.category,
        "amount": budget.amount,
        "period": budget.period,
        "created_at": budget.created_at,
    }
 
 
def _get_own_budget_or_404(db: Session, customer_id: str, budget_id: str) -> BudgetORM:
    budget = db.get(BudgetORM, budget_id)
    if budget is None or budget.customer_id != customer_id:
        # Same 404 whether it doesn't exist or belongs to someone else --
        # no reason to reveal that a budget_id belongs to another customer.
        raise NotFoundError(f"Budget '{budget_id}' does not exist.")
    return budget
 
 
def create_budget(db: Session, customer_id: str, category: str, amount: float, period: str):
    budget = BudgetORM(
        id=str(uuid.uuid4()),
        customer_id=customer_id,
        category=category,
        amount=amount,
        period=period,
        created_at=datetime.now(timezone.utc),
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return _serialize(budget)
 
 
def list_budgets(db: Session, customer_id: str):
    budgets = (
        db.query(BudgetORM)
        .filter(BudgetORM.customer_id == customer_id)
        .order_by(BudgetORM.created_at)
        .all()
    )
    return [_serialize(b) for b in budgets]
 
 
def update_budget(db: Session, customer_id: str, budget_id: str, category=None, amount=None, period=None):
    budget = _get_own_budget_or_404(db, customer_id, budget_id)
    if category is not None:
        budget.category = category
    if amount is not None:
        budget.amount = amount
    if period is not None:
        budget.period = period
    db.commit()
    db.refresh(budget)
    return _serialize(budget)
 
 
def delete_budget(db: Session, customer_id: str, budget_id: str):
    budget = _get_own_budget_or_404(db, customer_id, budget_id)
    db.delete(budget)
    db.commit()