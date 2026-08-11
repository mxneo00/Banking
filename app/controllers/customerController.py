""" Routes for /api/v1/customers."""

from typing import Optional
from fastapi import APIRouter
from models.schemas import CustomerCreate, CustomerUpdate
from services import customerService

router = APIRouter(prefix="/api/v1/customers", tags=["customers"])

# Customer CRUD operations
# POST /api/v1/customers - Create a new customer
@router.post("", status_code=201)
def create_customer(payload: CustomerCreate):
    """Create a new customer and return the serialized record."""
    customer = customerService.create_customer(
        customer_id=payload.customer_id,
        name=payload.name,
        email=payload.email,
        branch_id=payload.branch_id,
    )
    return customer.to_dict()

# GET /api/v1/customers - List customers
@router.get("")
def list_customers(branch_id: Optional[str] = None, active_only: Optional[bool] = None):
    """Return all customers, optionally filtered by branch or active status."""
    # FastAPI parses ?active_only=true/false into a real bool for us.
    customers = customerService.list_customers(branch_id=branch_id, active_only=active_only)
    return [c.to_dict() for c in customers]

# GET /api/v1/customers/{customer_id} - Get a specific customer
@router.get("/{customer_id}")
def get_customer(customer_id: str):
    """Fetch a single customer by ID; raises 404 if not found."""
    return customerService.get_customer(customer_id).to_dict()

# PUT /api/v1/customers/{customer_id} - Update a customer
@router.put("/{customer_id}")
def update_customer(customer_id: str, payload: CustomerUpdate):
    """Update mutable fields (name, email) on an existing customer."""
    customer = customerService.update_customer(
        customer_id, name=payload.name, email=payload.email
    )
    return customer.to_dict()

# DELETE /api/v1/customers/{customer_id} - Deactivate a customer
@router.delete("/{customer_id}")
def deactivate_customer(customer_id: str):
    """Deactivate (soft-delete) a customer. Their record and history stay."""
    customer = customerService.deactivate_customer(customer_id)
    return {
        "message": f"Customer '{customer_id}' has been deactivated.",
        "customer": customer.to_dict(),
    }