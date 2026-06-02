from app.db import SessionLocal
from app.models import User


def login_as(client, email: str, password: str) -> User:
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()
    response = client.post("/api/auth/login", json={"user_id": user.id, "password": password})
    assert response.status_code == 200
    return user


def test_non_admin_cannot_access_other_users_transcript(client):
    admin = login_as(client, "admin@test.com", "admin123")
    create_resp = client.post("/api/transcripts", json={"name": "Admin Owned", "description": "private"})
    assert create_resp.status_code == 200
    transcript_id = create_resp.json()["id"]
    assert create_resp.json()["owner_user_id"] == admin.id

    login_as(client, "user@test.com", "user123")

    assert client.get(f"/api/transcripts/{transcript_id}").status_code == 403
    assert client.get(f"/api/transcripts/{transcript_id}/lines").status_code == 403
    assert client.get(f"/api/transcripts/{transcript_id}/audio").status_code == 403
    assert client.post(f"/api/transcripts/{transcript_id}/export").status_code == 403
    assert client.delete(f"/api/transcripts/{transcript_id}").status_code == 403


def test_non_admin_cannot_use_admin_endpoints(client):
    login_as(client, "user@test.com", "user123")
    assert client.get("/api/users").status_code == 403
    assert client.get("/api/admin/audit-log").status_code == 403
