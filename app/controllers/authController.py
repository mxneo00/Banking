"""Routes for /api/v1/auth -- registration, login, token refresh, and
admin-only staff onboarding.

This is the ONLY controller whose routes are (mostly) public -- everything
else in the app requires a valid Bearer access token. See
security/dependencies.py for how `Depends(get_current_user)` and
`Depends(require_roles(...))` enforce that on the other controllers.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import UserORM, UserRole, get_db
from models.schemas import LoginRequest, RefreshRequest, RegisterRequest, StaffCreateRequest, TokenResponse
from security.dependencies import get_current_user, require_roles
from security.tokens import create_access_token, create_refresh_token
from services import authService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# POST /api/v1/auth/register - public customer self-signup
# Creates a CustomerDB profile + a linked login in one step, then logs the
# new user straight in (returns tokens) so they don't have to immediately
# call /login again with the password they just typed.
@router.post("/register", status_code=201, response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Sign up as a new customer."""
    user = authService.register_customer(
        db, email=payload.email, password=payload.password, name=payload.name, branch_id=payload.branch_id
    )
    return TokenResponse(access_token=create_access_token(user), refresh_token=create_refresh_token(user))


# POST /api/v1/auth/login - exchange email+password for a token pair
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Log in with email + password."""
    access_token, refresh_token = authService.login(db, email=payload.email, password=payload.password)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# POST /api/v1/auth/refresh - trade a still-valid refresh token for a new
# access token, without asking for the password again.
@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Get a new access token using a refresh token."""
    access_token = authService.refresh_access_token(db, refresh_token=payload.refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


# GET /api/v1/auth/me - "who am I?" -- handy for Postman/frontend to check
# a token is valid and see the current user's role without decoding the JWT.
@router.get("/me")
def get_me(current_user: UserORM = Depends(get_current_user)):
    """Return the caller's own user record."""
    return current_user.to_dict()


# POST /api/v1/auth/logout - invalidate every token issued to the caller.
# No request body: Depends(get_current_user) already identifies who's
# logging out from their Bearer token, and the SAME check it just ran
# (token_version) is what makes the logout stick on every future request.
@router.post("/logout")
def logout(db: Session = Depends(get_db), current_user: UserORM = Depends(get_current_user)):
    """Log out -- revokes ALL of this user's outstanding tokens (access and
    refresh, every device/session), not just the one used to call this."""
    authService.logout(db, current_user)
    return {"message": "Logged out. All previously issued tokens for this account are now invalid."}


# POST /api/v1/auth/staff - ADMIN-ONLY: onboard a teller/branch_manager/admin.
# Note the dependency: require_roles(UserRole.ADMIN) means this whole route
# 403s for anyone who isn't an admin, before create_staff_user ever runs.
@router.post("/staff", status_code=201)
def create_staff(
    payload: StaffCreateRequest,
    db: Session = Depends(get_db),
    _admin: UserORM = Depends(require_roles(UserRole.ADMIN)),
):
    """Create a teller, branch_manager, or admin login. Admins only --
    nobody can grant themselves elevated privileges through self-signup."""
    user = authService.create_staff_user(
        db, email=payload.email, password=payload.password, role=payload.role, branch_id=payload.branch_id
    )
    return user.to_dict()
