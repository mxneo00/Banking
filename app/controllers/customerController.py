""" Routes for /api/v1/customers. With Postgres Integration"""

from typing import Optional
from fastapi import APIRouter, Depends
from models.schemas import CustomerCreate, CustomerUpdate
from services import customerService
from models.database import get_db

router = APIRouter(prefix="/api/v1/customers", tags=["customers"])

# Customer CRUD operations
# POST /api/v1/customers - Create a new customer
@router.post("", status_code=201)
def create_customer(payload: CustomerCreate, db=Depends(get_db)):
    """Create a new customer and persist it to the database."""
    return customerService.create_customer(
        db, 
        customer_id=payload.customer_id, 
        name=payload.name, 
        email=payload.email, 
        branch_id=payload.branch_id
    )

# GET /api/v1/customers - List customers
@router.get("")
def list_customers(branch_id: Optional[str] = None, active_only: Optional[bool] = None, db=Depends(get_db)):
    """Return all customers, optionally filtered by branch or active status."""
    return customerService.list_customers(db, branch_id=branch_id, active_only=active_only)

# GET /api/v1/customers/{customer_id} - Get a specific customer
@router.get("/{customer_id}")
def get_customer(customer_id: str, db=Depends(get_db)):
    """Fetch a single customer by ID; raises 404 if not found."""
    return customerService.get_customer(db, customer_id)

# PUT /api/v1/customers/{customer_id} - Update a customer
@router.put("/{customer_id}")
def update_customer(customer_id: str, payload: CustomerUpdate, db=Depends(get_db)):
    """Update mutable fields (name, email) on an existing customer."""
    return customerService.update_customer(
        db, customer_id, name=payload.name, email=payload.email
    )

# DELETE /api/v1/customers/{customer_id} - Deactivate a customer
@router.delete("/{customer_id}")
def deactivate_customer(customer_id: str, db=Depends(get_db)):
    """Deactivate (soft-delete) a customer. Their record and history stay."""
    customer = customerService.deactivate_customer(db, customer_id)
    return {
        "message": f"Customer '{customer_id}' has been deactivated.",
        "customer": customer.to_dict(),
    }