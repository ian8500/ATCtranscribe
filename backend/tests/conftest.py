import os
import sys
import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///./test.db"

from app.db import Base, engine, SessionLocal
from app.main import app
from app.models import User, AccessLevel
from app.security import hash_password
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    admin = User(
        name="Admin",
        email="admin@test.com",
        password_hash=hash_password("admin123"),
        access_level=AccessLevel.admin,
        active=True,
    )
    user = User(
        name="User",
        email="user@test.com",
        password_hash=hash_password("user123"),
        access_level=AccessLevel.user,
        active=True,
    )
    db.add_all([admin, user])
    db.commit()
    db.close()
    yield


@pytest.fixture
def client():
    return TestClient(app)
