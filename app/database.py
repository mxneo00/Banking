import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured")

# manages conncetions to Postrgres
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True, # checks that a connection is still valid before using it
    echo=True # logs the SQL statements to the console
)

# creates database sessions
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False
)

# Parent class for SQLAlchemy table models
class Base(DeclarativeBase):
    pass

# Supplies one database session per API request
def get_db() -> Generator[Session, None, None]:
    database = SessionLocal()

    try:
        yield database
    finally:
        database.close()