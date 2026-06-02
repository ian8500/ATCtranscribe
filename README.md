# ATC Transcriber

Private ATC audio transcription workspace with FastAPI, SQLite/Postgres-ready persistence, local Whisper transcription, DOCX export, audit logging, and audio retention controls.

## Project Structure

```
backend/     FastAPI + SQLAlchemy + Alembic + faster-whisper
frontend/    React + Vite + Tailwind
```

## Mac Local Run

From a fresh clone, run:

```bash
./scripts/setup_mac.sh
```

Create a real first admin account:

```bash
ATC_ADMIN_EMAIL=you@example.com ATC_ADMIN_PASSWORD='use-a-long-unique-password' ./scripts/setup_mac.sh
```

For throwaway local testing only, create the development admin:

```bash
ATC_CREATE_DEV_ADMIN=true ./scripts/setup_mac.sh
```

Start the whole app:

```bash
./scripts/dev_all.sh
```

The script prints the app URL and opens it in your browser. By default:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8000/api/health`

Run services separately when debugging:

```bash
./scripts/run_backend.sh
```

```bash
./scripts/run_frontend.sh
```

Useful port overrides:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 ./scripts/dev_all.sh
```

Backend auto-reload is off by default for reliability. Enable it when actively editing backend code:

```bash
ATC_RELOAD=true ./scripts/run_backend.sh
```

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
ATC_CREATE_DEV_ADMIN=true python seed.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The development seed creates `admin@example.com` with password `admin123` only when `ATC_CREATE_DEV_ADMIN=true` is set. Do not use that shortcut with real recordings.

For a real first admin:

```bash
cd backend
ATC_ADMIN_EMAIL=you@example.com ATC_ADMIN_PASSWORD='use-a-long-unique-password' python seed.py
```

### Frontend

```bash
cd frontend
npm install
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

### Optional Audio Preprocessing

Install `ffmpeg` so uploads can be converted to mono 16kHz with ATC-band filtering before transcription:

```bash
brew install ffmpeg
```

## Desktop Launcher on macOS

Build or refresh the desktop app bundle:

```bash
./packaging/create_macos_app.sh
cp -R "ATC Investigation Desk.app" "$HOME/Desktop/ATC Investigation Desk.app"
```

Double-click **ATC Investigation Desk** on the Desktop. The launcher starts the backend and frontend on local private ports, opens the browser, and writes logs to `/tmp/ATCtranscribe`.

## Environment Variables

Copy `.env.example` and set deployment-specific values. Key backend variables:

- `APP_ENV` default `development`; set `production` for hardened startup checks.
- `DATABASE_URL` default `sqlite+pysqlite:///./atc.db`.
- `SECRET_KEY` must be a strong random value before using real recordings. The `.env.example` placeholder is rejected in production.
- `SESSION_COOKIE_NAME` default `atc_session`.
- `ACCESS_TOKEN_EXPIRE_MINUTES` default `60`.
- `SECURE_COOKIES` set `true` when served over HTTPS.
- `CORS_ORIGINS` comma-separated allowed frontend origins.
- `UPLOAD_DIR` default `./uploads`.
- `MAX_UPLOAD_MB` default `2048` for long WAV recordings. Increase only if your local disk has enough space.
- `WHISPER_MODEL` local accuracy preset `large-v3`; use `small` or `medium` only when speed matters more than accuracy.
- `WHISPER_DEVICE` default `cpu`.
- `WHISPER_COMPUTE_TYPE` default `int8`.
- `WHISPER_LOCAL_ONLY` set `true` after model files are cached for offline-only use.
- `WHISPER_TEMPERATURE=0`, `WHISPER_PROMPT_ENABLED=false`, `WHISPER_HOTWORDS_ENABLED=false`, word-confidence flagging, and balanced no-speech/log-prob thresholds reduce ATC hallucinations without blanking degraded speech.
- `WHISPER_FFMPEG_DENOISE=false` keeps denoise off by default; enable only if it improves your radio recordings.
- `DEV_EMAIL_CONSOLE` default `true`; set SMTP values for email delivery.
- `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_ATTEMPTS` configure the local in-memory limiter.

When `APP_ENV=production`, startup fails if `SECRET_KEY` is weak/default, `SECURE_COOKIES` is false, or `CORS_ORIGINS` contains `*`.

## Secure Deployment Notes

- Serve behind HTTPS and set `SECURE_COOKIES=true`.
- Restrict `CORS_ORIGINS` to the exact frontend origin.
- Use a strong `SECRET_KEY`; rotate it by forcing users to log in again.
- Keep `UPLOAD_DIR` outside publicly served directories and restrict filesystem permissions.
- Use least-privilege database credentials if moving off SQLite.
- Passwords are hashed with bcrypt.
- Session cookies are `httpOnly`, `sameSite=strict`, and expire with the JWT. The frontend redirects expired sessions to login, and the sidebar logout action clears the server cookie.
- Audit logs record login, upload, transcription start/finish/failure, export, complete/delete/reopen, and user management actions.
- Audit logs intentionally avoid transcript text and audio contents.
- The built-in rate limiter is in-memory and suitable for development or a single local process only. For multi-process production, put Redis, a reverse proxy, or an API gateway rate limiter in front of the app.

## Audio Retention & Deletion

- Transcript statuses: Draft → InProgress → Completed.
- Marking a transcript **Completed** purges all files in that transcript upload folder and clears WAV references.
- Transcript deletion also purges upload-folder audio.
- Startup purges stray audio references for completed transcripts.
- Deletion is best-effort overwrite plus unlink. On SSDs, snapshots, backups, and APFS copy-on-write, secure deletion cannot be guaranteed.

## Backup & Retention Guidance

- Decide whether backups may contain transcripts, audit logs, or uploaded audio before using real recordings.
- Exclude `UPLOAD_DIR` from routine backups if audio must not persist after completion.
- If backing up the database, treat transcript text and audit metadata as sensitive.
- For stronger audio deletion guarantees, use encrypted volumes and destroy encryption keys when data must be retired.

## Known Limitations

- Local background transcription jobs are process-local; they are not a durable distributed queue.
- In-memory rate limiting does not protect multiple worker processes.
- DOCX exports are direct downloads. They are generated as unique temporary files and deleted after the response is sent.
- Field-level encryption is not implemented; add envelope encryption if transcript text must be encrypted at rest.
- Whisper model downloads require network access unless `WHISPER_LOCAL_ONLY=true` and the model is already cached.

## Troubleshooting

### Missing `email-validator`

Symptom: backend import/startup errors mentioning `EmailStr` or `email-validator`.

Fix:

```bash
./scripts/setup_mac.sh
```

This reinstalls `backend/requirements.txt` into `backend/.venv`.

### `ffmpeg` Missing

Symptom: transcription still works, but backend logs say preprocessing is skipped.

Fix:

```bash
brew install ffmpeg
```

Without `ffmpeg`, uploaded WAV files are sent to Whisper without the mono/16kHz ATC-band preprocessing step.

### Faster-Whisper Model Download

The first transcription may download the configured Whisper model. This can take time and needs network access.

Speed-oriented local setting:

```bash
WHISPER_MODEL=small WHISPER_DEVICE=cpu WHISPER_COMPUTE_TYPE=int8 ./scripts/run_backend.sh
```

Accuracy-oriented local setting:

```bash
WHISPER_MODEL=large-v3 WHISPER_DEVICE=cpu WHISPER_COMPUTE_TYPE=int8 ./scripts/run_backend.sh
```

Anti-hallucination mode is the default. It uses deterministic decoding, disables the ATC prompt/hotwords unless explicitly enabled, drops only strong silence/repetition/hallucination patterns, and leaves uncertain spoken text flagged rather than blanking it.

After the model is cached, offline mode can be enabled in `.env`:

```bash
WHISPER_LOCAL_ONLY=true
```

### Python Version Issues

`setup_mac.sh` requires Python 3.10 or newer. Check:

```bash
python3 --version
```

Install a current Python from python.org or Homebrew if needed.

### npm Install Issues

If frontend setup fails, check Node/npm:

```bash
node --version
npm --version
```

Then retry:

```bash
cd frontend
npm install
```

If `node_modules` becomes inconsistent, remove it and rerun setup:

```bash
rm -rf frontend/node_modules
./scripts/setup_mac.sh
```

### Port Already in Use

If `8000` or `5173` is busy:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 ./scripts/dev_all.sh
```

## Tests

```bash
cd backend
source .venv/bin/activate
python -m pytest
```

```bash
cd frontend
npm run build
```
