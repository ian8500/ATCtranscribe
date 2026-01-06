# ATC Transcriber

Secure, multi-user ATC transcription platform with a premium UI and strict audio retention controls.

## Project Structure

```
backend/     FastAPI + SQLAlchemy + Alembic
frontend/    React + Vite + Tailwind
```

## Quick Start (Dev)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload
```

Whisper setup (CPU-only): the backend uses `faster-whisper` with the `base` model. The first transcription will download the model weights. For GPU support, follow the `faster-whisper` install guide and adjust `transcription.py` accordingly.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000`.

## Configuration

Environment variables (backend):

- `DATABASE_URL` (default sqlite+pysqlite:///./atc.db)
- `SECRET_KEY`
- `SESSION_COOKIE_NAME` (default `atc_session`)
- `SECURE_COOKIES` (set `true` when behind HTTPS)
- `UPLOAD_DIR` (default `./uploads`)
- SMTP variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `DEV_EMAIL_CONSOLE` (default `true` prints emails to console)

## Security Notes (Hardened Deployment)

- **HTTPS only**: terminate TLS at your reverse proxy and set `SECURE_COOKIES=true`.
- **Session cookies** are `httpOnly` and `sameSite=strict`.
- **Password hashing** uses bcrypt via passlib.
- **Rate limiting** is in-memory for login and forgot-password endpoints. For production, move to Redis or API gateway controls.
- **RBAC**: all transcript and line operations enforce ownership; admins can access all.
- **File validation**: WAV type and size enforced; max size configurable.
- **Least privilege**: use a DB user scoped to this database, and limit filesystem permissions of the uploads directory.
- **Optional field-level encryption**: if you need to encrypt transcript text at rest, add envelope encryption for `transcript_lines.text` and `transcripts.description` using a KMS-managed key. Ensure the application does not log decrypted content.

## Audio Retention & Deletion

- Transcript statuses: Draft → InProgress → Completed.
- When a transcript is marked **Completed**, the WAV is **immediately** deleted (best-effort overwrite then unlink).
- The app clears storage references; audio cannot be re-downloaded.
- A startup sweep purges any stray audio files for completed transcripts and logs to the audit log.

> Secure deletion depends on OS/filesystem behavior. Overwrite+unlink is best-effort and may not remove copies on SSD wear leveling or filesystem snapshots. If this is a critical requirement, use encrypted volumes and discard encryption keys on completion.

## Tests

```bash
cd backend
pytest
```
