""" Business logic for customer service """

from sqlalchemy.orm import Session
from models.domain import Customer
from models.exceptions import NotFoundError

def create_customer(db: Session, customer_id, name, email, branch_id):
    """Create a new customer and persist it to the database."""
    customer = Customer(customer_id, name, email, branch_id)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

def list_customers(db: Session, branch_id=None, active_only=None):
    """Return customers, optionally filtered by branch and/or active status."""
    query = db.query(Customer)
    if branch_id:
        query = query.filter(Customer.branch_id == branch_id)
    if active_only is not None:
        query = query.filter(Customer.is_active == active_only)
    return query.all()

def get_customer(db: Session, customer_id):
    """Fetch a single customer by ID; raises 404 if not found."""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise NotFoundError(f"Customer '{customer_id}' not found.")
    return customer

def update_customer(db: Session, customer_id, name=None, email=None):
    """Update only the fields that were supplied (partial update)."""
    customer = get_customer(db, customer_id)
    customer.update(name=name, email=email)
    db.commit()
    db.refresh(customer)
    return customer

def deactivate_customer(db: Session, customer_id):
    """Soft-delete a customer. Their history and accounts are kept."""
    customer = get_customer(db, customer_id)
    customer.deactivate()
    db.commit()
    return customer
