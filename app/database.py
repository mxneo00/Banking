""" Database connectivity """

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

try: 
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

engine = create_engine(DATABASE_URL, echo=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """ Dependency to get the database session """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_connection() -> None:
    """ Get a raw database connection """
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
