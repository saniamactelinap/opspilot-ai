import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Default to a local SQLite database file in the backend root
DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "opspilot.db")
DATABASE_URL = os.getenv("OPSPILOT_DB_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# SQLite requires check_same_thread=False when used across multiple threads in FastAPI
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)

# Session factory for database operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all SQLAlchemy ORM models
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a database session per request
    and ensures it is properly closed when the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create all database tables defined in models.py if they do not exist.
    """
    from app import models  # noqa: F401 - Ensure all models are registered
    Base.metadata.create_all(bind=engine)
