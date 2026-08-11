""" Business logic for customer service """

from models.domain import Customer
from models.repository import repository

def create_customer(customer_id, name, email, branch_id):
    """Create a new customer and add it to the repository."""
    customer = Customer(customer_id, name, email, branch_id)
    return repository.add_customer(customer)

def list_customers(branch_id=None, active_only=None):
    """Return customers, optionally filtered by branch and/or active status."""
    customers = repository.get_customers()
    if branch_id:
        customers = [c for c in customers if c.branch_id == branch_id]
    if active_only is not None:  # None means "no filter"; False returns inactive-only
        customers = [c for c in customers if c.is_active == active_only]
    return customers

def get_customer(customer_id):
    """Fetch a single customer by ID; raises an exception if not found."""
    return repository.get_customer(customer_id)

def update_customer(customer_id, name=None, email=None):
    """Update only the fields that were supplied (partial update)."""
    customer = repository.get_customer(customer_id)
    customer.update(name=name, email=email)  # None fields are left unchanged
    return customer

def deactivate_customer(customer_id):
    """Soft-delete a customer. Their history and accounts are kept."""
    customer = repository.get_customer(customer_id)
    customer.deactivate()
    return customer