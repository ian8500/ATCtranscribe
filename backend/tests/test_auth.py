from app.db import SessionLocal
from app.models import User
from app.settings import DEFAULT_DEV_SECRET, Settings


def test_login_and_me(client):
    db = SessionLocal()
    user = db.query(User).filter(User.email == "user@test.com").first()
    db.close()

    resp = client.post("/api/auth/login", json={"user_id": user.id, "password": "user123"})
    assert resp.status_code == 200

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "user@test.com"


def test_logout_clears_session(client):
    db = SessionLocal()
    user = db.query(User).filter(User.email == "user@test.com").first()
    db.close()

    resp = client.post("/api/auth/login", json={"user_id": user.id, "password": "user123"})
    assert resp.status_code == 200
    assert client.get("/api/auth/me").status_code == 200

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_production_rejects_unsafe_secret_and_cookie_settings():
    settings = Settings(app_env="production", secret_key=DEFAULT_DEV_SECRET, secure_cookies=False)
    try:
        settings.validate_security()
    except RuntimeError as exc:
        assert "SECRET_KEY" in str(exc)
        assert "SECURE_COOKIES" in str(exc)
    else:
        raise AssertionError("Production settings should reject weak defaults")
