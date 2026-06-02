import os
import shutil
import re
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from .settings import get_settings


settings = get_settings()
WAV_MIME_TYPES = {"audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"}


def upload_base_dir() -> Path:
    base = Path(settings.upload_dir).resolve()
    base.mkdir(parents=True, exist_ok=True)
    return base


def sanitize_filename(filename: str | None) -> str:
    if not filename:
        return "audio.wav"
    name = Path(filename).name
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")
    return name[:120] or "audio.wav"


def is_within_upload_dir(path: Path) -> bool:
    try:
        path.resolve().relative_to(upload_base_dir())
        return True
    except ValueError:
        return False


def ensure_upload_dir(transcript_id: int) -> str:
    base = upload_base_dir()
    path = (base / str(transcript_id)).resolve()
    if not is_within_upload_dir(path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload path")
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def validate_wav_signature(upload: UploadFile) -> None:
    upload.file.seek(0)
    header = upload.file.read(12)
    upload.file.seek(0)
    if len(header) < 12 or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid WAV file signature")


def save_wav_file(transcript_id: int, upload: UploadFile) -> str:
    filename = sanitize_filename(upload.filename)
    if upload.content_type not in WAV_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid WAV file")
    if not filename.lower().endswith(".wav"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid WAV extension")
    validate_wav_signature(upload)

    size_limit = settings.max_upload_mb * 1024 * 1024
    path = ensure_upload_dir(transcript_id)
    target = str((Path(path) / "audio.wav").resolve())
    if not is_within_upload_dir(Path(target)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload target")

    total = 0
    with open(target, "wb") as out:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > size_limit:
                out.close()
                os.remove(target)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large")
            out.write(chunk)
    return target


def secure_delete_file(path: str) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        length = os.path.getsize(path)
        with open(path, "r+b") as handle:
            handle.write(b"\x00" * length)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        pass
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


def purge_transcript_audio(transcript_id: int) -> None:
    base = (upload_base_dir() / str(transcript_id)).resolve()
    if not is_within_upload_dir(base):
        return
    if base.exists():
        for root, _, files in os.walk(base):
            for filename in files:
                secure_delete_file(str(Path(root) / filename))
        shutil.rmtree(base, ignore_errors=True)
