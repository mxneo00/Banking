"""Tests for app/services/authService.py and security/dependencies.py.

These hit a real Postgres database -- see conftest.py's autouse fixture,
which resets customers/accounts/transactions/users/budgets before every test
and redirects DATABASE_URL at a dedicated `_test` database so this never
touches real app data. A local Postgres server must be reachable before
these tests execute.
"""

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from models.database import SessionLocal, UserRole
from models.exceptions import DuplicateError
from security.dependencies import get_current_user, is_staff
from security.tokens import decode_token
from services import authService


class TestRegisterCustomer:
    def test_creates_a_login_and_a_customer_profile(self):
        with SessionLocal() as db:
            user = authService.register_customer(
                db, email="new@example.com", password="testpassword", name="New User", branch_id="BR001",
            )

        assert user.email == "new@example.com"
        assert user.hashed_password != "testpassword"  # stored hashed, not plaintext
        assert user.role == UserRole.CUSTOMER.value
        assert user.customer_id is not None

    def test_duplicate_email_raises(self):
        with SessionLocal() as db:
            authService.register_customer(
                db, email="dup@example.com", password="testpassword", name="Dup User", branch_id="BR001",
            )
            with pytest.raises(DuplicateError):
                authService.register_customer(
                    db, email="dup@example.com", password="testpassword", name="Dup User", branch_id="BR001",
                )


class TestCreateStaffUser:
    def test_creates_a_staff_login_with_no_customer_profile(self):
        with SessionLocal() as db:
            user = authService.create_staff_user(
                db, email="teller@example.com", password="staffpassword", role="teller", branch_id="BR001",
            )

        assert user.email == "teller@example.com"
        assert user.role == "teller"
        assert user.customer_id is None
        assert is_staff(user) is True


class TestAuthenticateUser:
    def test_correct_credentials_returns_the_user(self):
        with SessionLocal() as db:
            authService.register_customer(
                db, email="auth@example.com", password="authpassword", name="Auth User", branch_id="BR001",
            )
            user = authService.authenticate_user(db, "auth@example.com", "authpassword")

        assert user.email == "auth@example.com"

    def test_wrong_password_raises_401(self):
        with SessionLocal() as db:
            authService.register_customer(
                db, email="wrongpw@example.com", password="rightpassword", name="Wrong Pw", branch_id="BR001",
            )
            with pytest.raises(HTTPException) as exc_info:
                authService.authenticate_user(db, "wrongpw@example.com", "wrongpassword")

        assert exc_info.value.status_code == 401

    def test_unknown_email_raises_401(self):
        # Same 401 as a wrong password -- authService deliberately doesn't
        # distinguish "no such user" from "wrong password" (see its docstring).
        with SessionLocal() as db:
            with pytest.raises(HTTPException) as exc_info:
                authService.authenticate_user(db, "nosuchuser@example.com", "whatever123")

        assert exc_info.value.status_code == 401


class TestLoginAndTokens:
    def test_login_returns_a_valid_access_and_refresh_token(self):
        with SessionLocal() as db:
            user = authService.register_customer(
                db, email="tokenuser@example.com", password="tokenpassword", name="Token User", branch_id="BR001",
            )
            access_token, refresh_token = authService.login(db, "tokenuser@example.com", "tokenpassword")

        access_payload = decode_token(access_token, expected_type="access")
        refresh_payload = decode_token(refresh_token, expected_type="refresh")

        assert access_payload["sub"] == user.user_id
        assert access_payload["email"] == "tokenuser@example.com"
        assert refresh_payload["sub"] == user.user_id

    def test_refresh_access_token_issues_a_new_access_token(self):
        with SessionLocal() as db:
            authService.register_customer(
                db, email="refresh@example.com", password="refreshpassword", name="Refresh User", branch_id="BR001",
            )
            _, refresh_token = authService.login(db, "refresh@example.com", "refreshpassword")
            new_access_token = authService.refresh_access_token(db, refresh_token)

        payload = decode_token(new_access_token, expected_type="access")
        assert payload["email"] == "refresh@example.com"

    def test_logout_revokes_the_refresh_token(self):
        with SessionLocal() as db:
            authService.register_customer(
                db, email="logout@example.com", password="logoutpassword", name="Logout User", branch_id="BR001",
            )
            _, refresh_token = authService.login(db, "logout@example.com", "logoutpassword")
            user = authService.authenticate_user(db, "logout@example.com", "logoutpassword")
            authService.logout(db, user)

            with pytest.raises(HTTPException) as exc_info:
                authService.refresh_access_token(db, refresh_token)

        assert exc_info.value.status_code == 401


class TestGetCurrentUser:
    def test_returns_the_user_for_a_valid_access_token(self):
        with SessionLocal() as db:
            registered = authService.register_customer(
                db, email="me@example.com", password="mepassword", name="Me User", branch_id="BR001",
            )
            access_token, _ = authService.login(db, "me@example.com", "mepassword")
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)
            current_user = get_current_user(credentials=credentials, db=db)

        assert current_user.user_id == registered.user_id

    def test_rejects_a_token_revoked_by_logout(self):
        with SessionLocal() as db:
            authService.register_customer(
                db, email="revoked@example.com", password="revokedpassword", name="Revoked User", branch_id="BR001",
            )
            access_token, _ = authService.login(db, "revoked@example.com", "revokedpassword")
            user = authService.authenticate_user(db, "revoked@example.com", "revokedpassword")
            authService.logout(db, user)

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(credentials=credentials, db=db)

        assert exc_info.value.status_code == 401
