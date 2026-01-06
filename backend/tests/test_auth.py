from app.db import SessionLocal
from app.models import User


def test_login_and_me(client):
    db = SessionLocal()
    user = db.query(User).filter(User.email == "user@test.com").first()
    db.close()

    resp = client.post("/api/auth/login", json={"user_id": user.id, "password": "user123"})
    assert resp.status_code == 200

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "user@test.com"
