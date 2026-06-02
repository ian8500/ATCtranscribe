from app.db import SessionLocal
from app.models import TranscriptLine, TranscriptionJob, TranscriptionJobStatus, User
from tests.test_transcripts import minimal_wav


def login(client):
    db = SessionLocal()
    user = db.query(User).filter(User.email == "user@test.com").first()
    db.close()
    client.post("/api/auth/login", json={"user_id": user.id, "password": "user123"})


def test_start_transcription_job_with_mocked_transcriber(client, monkeypatch):
    login(client)

    create_resp = client.post("/api/transcripts", json={"name": "Job Test", "description": "desc"})
    transcript_id = create_resp.json()["id"]
    upload_resp = client.post(
        f"/api/transcripts/{transcript_id}/upload-wav",
        files={"file": ("job-test.wav", minimal_wav(), "audio/wav")},
    )
    assert upload_resp.status_code == 200

    def fake_transcribe_audio(wav_path, start_time, exclude_list, vocabulary, transcript_id=None):
        return [
            {
                "timestamp_hms": start_time,
                "text": "Tower Speedbird 123 cleared to land runway two seven left",
                "flags_json": {"avg_logprob": -0.2, "no_speech_prob": 0.1},
            }
        ]

    monkeypatch.setattr("app.main.transcribe_audio", fake_transcribe_audio)

    start_resp = client.post(f"/api/transcripts/{transcript_id}/transcribe", json={"start_time": "10:15:00"})
    assert start_resp.status_code == 200
    job_id = start_resp.json()["id"]

    status_resp = client.get(f"/api/transcripts/{transcript_id}/transcription-job")
    assert status_resp.status_code == 200
    assert status_resp.json()["id"] == job_id
    assert status_resp.json()["status"] == "completed"
    assert status_resp.json()["progress"] == 100

    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        line = db.query(TranscriptLine).filter(TranscriptLine.transcript_id == transcript_id).first()
        assert job.status == TranscriptionJobStatus.completed
        assert line.text.startswith("Tower Speedbird 123")
    finally:
        db.close()
