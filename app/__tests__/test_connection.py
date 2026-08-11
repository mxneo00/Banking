"""Test the local database connection.
Run with python from the root directory:
.\.venv\Scripts\python.exe app\__tests__\test_connection.py
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL was not found")

engine = create_engine(database_url)

with engine.connect() as connection:
    result = connection.execute(
        text(
            """
            SELECT
                current_database(),
                current_user,
                inet_server_port()
            """
        )
    ).one()

    print("Database:", result[0])
    print("User:", result[1])
    print("Port:", result[2])

print("Connection closed successfully")