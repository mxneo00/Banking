"""Business logic for registration, login, token refresh, and staff creation.

Mirrors the pattern the other services already use (accountService,
customerService): a SQLAlchemy Session passed in by the controller,
straightforward functions, domain exceptions for the caller to map to
status codes. Password/token mechanics themselves live in security/ --
this module wires them together with the database.
"""

from typing import Optional, Tuple

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.database import CustomerDB, UserORM, UserRole
from models.exceptions import DuplicateError
from security.passwords import hash_password, verify_password
from security.tokens import create_access_token, create_refresh_token, decode_token


def _next_customer_id(db: Session) -> str:
    """Generate the next CUST-## id, same generated-id style accountService
    uses for account numbers. Self-signup doesn't ask the customer to
    invent their own internal ID."""
    ids = db.query(CustomerDB.customer_id).all()
    max_n = 0
    for (customer_id,) in ids:
        if customer_id.startswith("CUST-") and customer_id[5:].isdigit():
            max_n = max(max_n, int(customer_id[5:]))
    return f"CUST-{max_n + 1:02d}"


def register_customer(db: Session, email: str, password: str, name: str, branch_id: str) -> UserORM:
    """Public self-signup: creates a CustomerDB profile AND a linked
    UserORM login (role=customer) together, as one signed-up "account"
    from the caller's point of view.
    """
    email = email.strip().lower()
    if db.query(UserORM).filter(UserORM.email == email).first() is not None:
        raise DuplicateError(f"An account with email '{email}' already exists.")

    customer = CustomerDB(customer_id=_next_customer_id(db), name=name, email=email, branch_id=branch_id)
    db.add(customer)
    db.flush()  # assigns the row within this transaction so the FK below is satisfiable

    user = UserORM(
        email=email,
        hashed_password=hash_password(password),
        role=UserRole.CUSTOMER.value,
        customer_id=customer.customer_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_staff_user(db: Session, email: str, password: str, role: str, branch_id: Optional[str]) -> UserORM:
    """Admin-only onboarding for teller/branch_manager/admin users.

    No CustomerDB profile is created here -- staff aren't bank customers,
    so `UserORM.customer_id` stays null for them.
    """
    email = email.strip().lower()
    if db.query(UserORM).filter(UserORM.email == email).first() is not None:
        raise DuplicateError(f"An account with email '{email}' already exists.")

    user = UserORM(
        email=email,
        hashed_password=hash_password(password),
        role=role,
        branch_id=branch_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> UserORM:
    """Look up a user by email and verify their password.

    Deliberately raises the SAME 401 for "no such email" and "right email,
    wrong password" -- returning a different error for each would let an
    attacker use the login endpoint to enumerate which emails are
    registered, one guess at a time.
    """
    email = email.strip().lower()
    user = db.query(UserORM).filter(UserORM.email == email).first()
    if user is None or not user.is_active or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return user


def login(db: Session, email: str, password: str) -> Tuple[str, str]:
    """Authenticate, then issue a fresh (access_token, refresh_token) pair."""
    user = authenticate_user(db, email, password)
    return create_access_token(user), create_refresh_token(user)


def refresh_access_token(db: Session, refresh_token: str) -> str:
    """Exchange a still-valid refresh token for a new access token, without
    requiring the password again -- that's the whole point of having a
    refresh token."""
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired; please log in again."
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    user = db.get(UserORM, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return create_access_token(user)
