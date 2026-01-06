import os
import shutil
from fastapi import UploadFile, HTTPException, status
from .settings import get_settings


settings = get_settings()


def ensure_upload_dir(transcript_id: int) -> str:
    path = os.path.join(settings.upload_dir, str(transcript_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_wav_file(transcript_id: int, upload: UploadFile) -> str:
    if upload.content_type not in ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid WAV file")
    if not upload.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid WAV extension")

    size_limit = settings.max_upload_mb * 1024 * 1024
    path = ensure_upload_dir(transcript_id)
    target = os.path.join(path, "audio.wav")

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
    base = os.path.join(settings.upload_dir, str(transcript_id))
    if os.path.exists(base):
        for root, _, files in os.walk(base):
            for filename in files:
                secure_delete_file(os.path.join(root, filename))
        shutil.rmtree(base, ignore_errors=True)
