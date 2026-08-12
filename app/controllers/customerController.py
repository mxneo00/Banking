""" Routes for /api/v1/customers. With Postgres Integration + RBAC.

Access rules (see security/dependencies.py for the mechanics):
  - create/list/deactivate : staff only (teller, branch_manager, admin)
  - get/update one customer: that customer themselves, or staff
Public self-signup goes through POST /api/v1/auth/register instead of
POST /api/v1/customers -- this endpoint is for staff creating/managing
customer profiles (e.g. in-branch onboarding), not self-service signup.
"""

from typing import Optional
from fastapi import APIRouter, Depends
from models.database import UserORM, UserRole, get_db
from models.schemas import CustomerCreate, CustomerUpdate
from security.dependencies import ensure_self_or_staff, get_current_user, require_roles
from services import customerService

router = APIRouter(prefix="/api/v1/customers", tags=["customers"])

# Any of these three roles counts as "staff" for this controller's purposes.
_STAFF_ONLY = require_roles(UserRole.TELLER, UserRole.BRANCH_MANAGER, UserRole.ADMIN)

# Customer CRUD operations
# POST /api/v1/customers - Create a new customer (staff-assisted onboarding)
@router.post("", status_code=201)
def create_customer(payload: CustomerCreate, db=Depends(get_db), _staff: UserORM = Depends(_STAFF_ONLY)):
    """Create a new customer and persist it to the database. Staff only."""
    return customerService.create_customer(
        db,
        customer_id=payload.customer_id,
        name=payload.name,
        email=payload.email,
        branch_id=payload.branch_id
    )

# GET /api/v1/customers - List customers (staff only -- customers shouldn't
# be able to browse every other customer's profile)
@router.get("")
def list_customers(
    branch_id: Optional[str] = None,
    active_only: Optional[bool] = None,
    db=Depends(get_db),
    _staff: UserORM = Depends(_STAFF_ONLY),
):
    """Return all customers, optionally filtered by branch or active status. Staff only."""
    return customerService.list_customers(db, branch_id=branch_id, active_only=active_only)

# GET /api/v1/customers/{customer_id} - Get a specific customer
# A customer may fetch their OWN profile; staff may fetch anyone's.
@router.get("/{customer_id}")
def get_customer(customer_id: str, db=Depends(get_db), current_user: UserORM = Depends(get_current_user)):
    """Fetch a single customer by ID; raises 404 if not found, 403 if it's not yours and you're not staff."""
    ensure_self_or_staff(current_user, customer_id)
    return customerService.get_customer(db, customer_id)

# PUT /api/v1/customers/{customer_id} - Update a customer
# Same rule as GET: self or staff.
@router.put("/{customer_id}")
def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db=Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Update mutable fields (name, email) on an existing customer."""
    ensure_self_or_staff(current_user, customer_id)
    return customerService.update_customer(
        db, customer_id, name=payload.name, email=payload.email
    )

# DELETE /api/v1/customers/{customer_id} - Deactivate a customer (staff only
# -- closing/deactivating an account is a staff action, not self-service)
@router.delete("/{customer_id}")
def deactivate_customer(customer_id: str, db=Depends(get_db), _staff: UserORM = Depends(_STAFF_ONLY)):
    """Deactivate (soft-delete) a customer. Their record and history stay."""
    customer = customerService.deactivate_customer(db, customer_id)
    return {
        "message": f"Customer '{customer_id}' has been deactivated.",
        "customer": customer,
    }
