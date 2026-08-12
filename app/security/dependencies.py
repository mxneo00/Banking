"""FastAPI dependencies for authentication (who is this?) and authorization
(are they allowed to do this?).

Two things routes pull from here:

- `get_current_user`       -- decodes the caller's Bearer access token and
                               loads the matching UserORM row. Every
                               protected route depends on this, directly or
                               transitively, to answer "who is calling?".
- `require_roles(...)`     -- a dependency *factory*. Call it with the
                               role(s) allowed to use a route; it returns a
                               dependency that 403s everyone else. This is
                               the RBAC (Role-Based Access Control) part.

Plus `ensure_self_or_staff`, a plain helper (not a dependency -- it needs a
`customer_id` that's only known partway through a route body, e.g. after
looking up an account) for the "customers can only touch their own data"
rule used across accounts/transactions/customers.
"""

from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from models.database import STAFF_ROLES, UserORM, UserRole, get_db
from security.tokens import decode_token

# HTTPBearer parses the `Authorization: Bearer <token>` header for us, and
# (with auto_error=True, the default) returns a 403 automatically if the
# header is missing entirely -- before get_current_user even runs. It also
# makes FastAPI's /docs show an "Authorize" button for testing.
_bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> UserORM:
    """Resolve the caller's identity from their Bearer access token."""
    token = credentials.credentials
    try:
        payload = decode_token(token, expected_type="access")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has expired.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.")

    user = db.get(UserORM, payload.get("sub"))
    # Re-checking the DB (instead of trusting the token's claims alone)
    # matters here: it catches a user who was deactivated *after* this
    # token was issued. Their token is still validly signed and unexpired,
    # but it stops working the moment an admin deactivates them.
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return user


def require_roles(*allowed_roles: UserRole):
    """Dependency factory for RBAC: only the listed roles may use this route.

    Usage in a controller:
        @router.post("/staff")
        def create_staff(..., admin: UserORM = Depends(require_roles(UserRole.ADMIN))):
            ...
    """
    allowed_values = {role.value for role in allowed_roles}

    def _check_role(current_user: UserORM = Depends(get_current_user)) -> UserORM:
        if current_user.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {sorted(allowed_values)}.",
            )
        return current_user

    return _check_role


def is_staff(user: UserORM) -> bool:
    """True for teller/branch_manager/admin -- anyone who can act on behalf
    of a customer rather than only themselves."""
    return user.role in {role.value for role in STAFF_ROLES}


def ensure_self_or_staff(current_user: UserORM, customer_id: Optional[str]) -> None:
    """Enforce "customers may only touch their own data; staff may touch any."

    Not a FastAPI dependency itself -- call it directly inside a route/service
    once you know which customer_id the resource in question belongs to
    (e.g. after fetching the account you're about to return). Raises 403 if
    a CUSTOMER is trying to reach something that isn't theirs.
    """
    if is_staff(current_user):
        return
    if current_user.customer_id != customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own data.",
        )
