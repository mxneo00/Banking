""" Run this first before wiring Postgres to your app. It will check if the
connection is working and if the database is reachable.
        python check_connection.py
"""

import sys

sys.path.append("app")

from sqlalchemy import text
from models.database import DATABASE_URL, engine


def redact(url: str) -> str:
    """ Redact the password from the database URL for logging purposes """
    if "@" in url:
        parts = url.split("@")
        if len(parts) == 2:
            return f"{parts[0].split(':')[0]}:***@{parts[1]}"
    return url


if __name__ == "__main__":
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print(f"Successfully connected to the database at {redact(DATABASE_URL)}")
    except Exception as e:
        print(f"Failed to connect to the database at {redact(DATABASE_URL)}: {e}")
        sys.exit(1)