import os
from app.db import SessionLocal
from app.models import User, Transcript, TranscriptStatus


def login(client):
    db = SessionLocal()
    user = db.query(User).filter(User.email == "user@test.com").first()
    db.close()
    client.post("/api/auth/login", json={"user_id": user.id, "password": "user123"})
    return user


def test_transcript_crud_and_completion(client):
    user = login(client)

    create_resp = client.post("/api/transcripts", json={"name": "Test", "description": "desc"})
    assert create_resp.status_code == 200
    transcript_id = create_resp.json()["id"]

    wav_bytes = b"RIFF" + b"\x00" * 100
    upload_resp = client.post(
        f"/api/transcripts/{transcript_id}/upload-wav",
        files={"file": ("test.wav", wav_bytes, "audio/wav")},
    )
    assert upload_resp.status_code == 200

    path = os.path.join("./uploads", str(transcript_id), "audio.wav")
    assert os.path.exists(path)

    complete_resp = client.post(f"/api/transcripts/{transcript_id}/mark-complete")
    assert complete_resp.status_code == 200
    assert not os.path.exists(path)

    db = SessionLocal()
    transcript = db.get(Transcript, transcript_id)
    assert transcript.status == TranscriptStatus.completed
    assert transcript.wav_storage_path is None
    db.close()
