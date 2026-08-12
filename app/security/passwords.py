"""Password hashing -- the only place in the app that should ever touch
a raw password.

Uses `bcrypt` directly (not the `passlib` wrapper some tutorials use --
passlib is unmaintained and breaks on bcrypt>=4.1). bcrypt salts
automatically and folds the salt into its own output string, so we never
store or manage a salt column ourselves.

Why hashing at all: if the `users` table ever leaks (backup exposed, SQL
injection, disgruntled employee with DB access...), an attacker who only has
hashes still can't log in as anyone -- they'd have to brute-force each
password individually, and bcrypt is deliberately slow to make that
expensive. Storing plaintext passwords means one leak compromises every
user's password immediately, and probably their accounts on other sites too
(people reuse passwords).
"""

import bcrypt


def hash_password(plain_password: str) -> str:
    """Hash a password for storage. Never store the return value of this
    anywhere but the `hashed_password` column."""
    # bcrypt works on bytes, not str, and has a hard 72-byte input limit
    # (silently truncates beyond that) -- fine for normal passwords.
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()  # a fresh random salt every call, by design
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a login attempt's password against the stored hash.

    Returns False (never raises) for a malformed/corrupt stored hash --
    treat it the same as "wrong password" rather than leaking a 500 that
    hints something is wrong with that specific account.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False
