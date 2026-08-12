"""JWT creation and decoding.

Two token types, both signed with the same secret but never interchangeable
(see the `"type"` claim below):

- **access token**: short-lived (ACCESS_TOKEN_EXPIRE_MINUTES). Sent as
  `Authorization: Bearer <token>` on every protected request. If it leaks,
  the damage window is small because it expires quickly.
- **refresh token**: long-lived (REFRESH_TOKEN_EXPIRE_DAYS). Used only to
  get a new access token via POST /api/v1/auth/refresh, so a user doesn't
  have to re-enter their password every 30 minutes. Longer-lived tokens are
  more dangerous if leaked, so they're never sent on normal API calls --
  only to the one refresh endpoint.

JWTs are signed, not encrypted: anyone can base64-decode a token and read
its payload (try it at jwt.io). The signature only proves it was issued by
us and hasn't been tampered with -- never put secrets (passwords, etc.) in
a token payload.
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv

# Safe to call again even if models/database.py already loaded .env --
# load_dotenv() is idempotent and this keeps the module independently usable.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Copy .env.example to .env in the project "
        "root (or add JWT_SECRET_KEY to your existing .env)."
    )

JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


def _create_token(user, expires_delta: timedelta, token_type: str) -> str:
    """Shared builder for both token types -- only the expiry and `type`
    claim differ between an access and a refresh token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.user_id,      # "subject", JWT-standard claim name for who this token is about
        "email": user.email,
        "roles": [user.role],     # a list; even though today a user has exactly one role, itkeeps the token shape stable if multi-role support gets added later
        "type": token_type,       # "access" or "refresh", stops a refresh token being used to call normal endpoints, and vice versa (see decode_token below)
        "ver": user.token_version,  # must match UserORM.token_version at request time or the
                                     # token is treated as revoked -- see security/dependencies.py.
                                     # This is what makes /auth/logout actually invalidate tokens
                                     # instead of just telling the client to forget one.
        "iat": now,                # issued-at
        "exp": now + expires_delta,  # expiry, PyJWT checks this automatically on decode
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_access_token(user) -> str:
    """Issue a short-lived access token for `user` (a UserORM row)."""
    return _create_token(user, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES), token_type="access")


def create_refresh_token(user) -> str:
    """Issue a long-lived refresh token for `user` (a UserORM row)."""
    return _create_token(user, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS), token_type="refresh")


def decode_token(token: str, expected_type: Optional[str] = None) -> dict:
    """Verify a token's signature and expiry, and return its payload.

    Raises jwt.PyJWTError (or a subclass, e.g. jwt.ExpiredSignatureError)
    on anything wrong -- expired, tampered, malformed, wrong secret. Callers
    (security/dependencies.py) catch that and turn it into a 401.

    `expected_type`, when given, additionally rejects a well-formed, validly
    signed token of the *wrong kind* -- e.g. someone passing a refresh token
    as their Bearer access token. Without this check, a leaked refresh token
    would work everywhere an access token does, defeating the whole point of
    keeping them separate.
    """
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    if expected_type is not None and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Expected a {expected_type} token, got {payload.get('type')!r}.")
    return payload
