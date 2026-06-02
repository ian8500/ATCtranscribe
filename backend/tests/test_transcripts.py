import glob
import os
import tempfile
from app.db import SessionLocal
from app.models import User, Transcript, TranscriptStatus


def minimal_wav() -> bytes:
    return b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 64


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

    wav_bytes = minimal_wav()
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


def test_completed_transcript_purges_all_audio_files(client):
    login(client)
    create_resp = client.post("/api/transcripts", json={"name": "Purge Test", "description": "desc"})
    transcript_id = create_resp.json()["id"]
    upload_resp = client.post(
        f"/api/transcripts/{transcript_id}/upload-wav",
        files={"file": ("../unsafe name.wav", minimal_wav(), "audio/wav")},
    )
    assert upload_resp.status_code == 200

    extra_path = os.path.join("./uploads", str(transcript_id), "preprocessed_16khz_mono.wav")
    with open(extra_path, "wb") as handle:
        handle.write(minimal_wav())

    complete_resp = client.post(f"/api/transcripts/{transcript_id}/mark-complete")
    assert complete_resp.status_code == 200
    assert not os.path.exists(os.path.join("./uploads", str(transcript_id)))


def test_rejects_invalid_wav_signature(client):
    login(client)
    create_resp = client.post("/api/transcripts", json={"name": "Bad WAV", "description": "desc"})
    transcript_id = create_resp.json()["id"]
    upload_resp = client.post(
        f"/api/transcripts/{transcript_id}/upload-wav",
        files={"file": ("bad.wav", b"not a real wav", "audio/wav")},
    )
    assert upload_resp.status_code == 400


def test_docx_export_download_removes_temp_file(client):
    login(client)
    create_resp = client.post("/api/transcripts", json={"name": "Export Test", "description": "desc"})
    transcript_id = create_resp.json()["id"]
    client.post(
        f"/api/transcripts/{transcript_id}/lines",
        json={"order_index": 0, "timestamp_hms": "10:00:00", "speaker_label_id": None, "text": "Tower Speedbird 123 cleared to land"},
    )

    response = client.post(f"/api/transcripts/{transcript_id}/export")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    leftovers = glob.glob(os.path.join(tempfile.gettempdir(), f"atc_transcript_{transcript_id}_*.docx"))
    assert leftovers == []
