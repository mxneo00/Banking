""" Business logic for customer service """

from sqlalchemy.orm import Session
from models.exceptions import DuplicateError, NotFoundError
from models.database import CustomerDB

def _serialize_customer(customer: CustomerDB) -> dict:
    """Shape a Customer row the same way the rest of the API returns customers."""
    account_numbers = [account.account_number for account in customer.accounts]
    return {
        "customer_id": customer.customer_id,
        "name": customer.name,
        "email": customer.email,
        "branch_id": customer.branch_id,
        "is_active": customer.is_active,
        "account_numbers": account_numbers,
    }

def _get_customer_row(db: Session, customer_id: str) -> CustomerDB:
    """Fetch a single customer row by ID; raises 404 if not found."""
    customer = db.get(CustomerDB, customer_id)
    if not customer:
        raise NotFoundError(f"Customer '{customer_id}' not found.")
    return customer

def create_customer(db: Session, customer_id, name, email, branch_id):
    """Create a new customer and persist it to the database."""
    if db.get(CustomerDB, customer_id):
        raise DuplicateError(f"Customer '{customer_id}' already exists.")
    customer = CustomerDB(customer_id=customer_id, name=name, email=email, branch_id=branch_id)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)

def list_customers(db: Session, branch_id=None, active_only=None):
    """Return customers, optionally filtered by branch and/or active status."""
    query = db.query(CustomerDB)
    if branch_id:
        query = query.filter(CustomerDB.branch_id == branch_id)
    if active_only is not None:
        query = query.filter(CustomerDB.is_active == active_only)
    return [_serialize_customer(c) for c in query.all()]

def get_customer(db: Session, customer_id):
    """Fetch a single customer by ID; raises 404 if not found."""
    return _serialize_customer(_get_customer_row(db, customer_id))

def update_customer(db: Session, customer_id, name=None, email=None):
    """Update only the fields that were supplied (partial update)."""
    customer = _get_customer_row(db, customer_id)
    if name is not None:
        customer.name = name
    if email is not None:
        customer.email = email
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)

def deactivate_customer(db: Session, customer_id):
    """Soft-delete a customer. Their history and accounts are kept."""
    customer = _get_customer_row(db, customer_id)
    customer.is_active = False
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)
