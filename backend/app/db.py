from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .settings import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
database_url = make_url(settings.database_url)
connect_args = {"check_same_thread": False} if database_url.drivername.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _sqlite_path() -> Path | None:
    if not database_url.drivername.startswith("sqlite"):
        return None
    if database_url.database in (None, "", ":memory:"):
        return None
    return Path(database_url.database)


def ensure_database_ready() -> None:
    """Prepare a local SQLite database using Alembic migrations."""
    sqlite_path = _sqlite_path()
    if sqlite_path and sqlite_path.parent != Path("."):
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    if database_url.drivername.startswith("sqlite"):
        alembic_ini = Path(__file__).resolve().parents[1] / "alembic.ini"
        if not alembic_ini.exists():
            alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
        config = Config(str(alembic_ini))
        config.set_main_option("sqlalchemy.url", settings.database_url)
        command.upgrade(config, "head")

        inspector = inspect(engine)
        if "users" not in inspector.get_table_names():
            raise RuntimeError("Database migrations completed but required tables are missing")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
