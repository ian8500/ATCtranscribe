from pydantic import BaseModel
from functools import lru_cache
import os


class Settings(BaseModel):
    database_url: str = os.getenv("DATABASE_URL", "sqlite+pysqlite:///./atc.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change")
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "atc_session")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    secure_cookies: bool = os.getenv("SECURE_COOKIES", "false").lower() == "true"
    smtp_host: str | None = os.getenv("SMTP_HOST")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str | None = os.getenv("SMTP_USER")
    smtp_password: str | None = os.getenv("SMTP_PASSWORD")
    smtp_from: str = os.getenv("SMTP_FROM", "noreply@atc.local")
    dev_email_console: bool = os.getenv("DEV_EMAIL_CONSOLE", "true").lower() == "true"
    upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "200"))
    rate_limit_window_seconds: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    rate_limit_max_attempts: int = int(os.getenv("RATE_LIMIT_MAX_ATTEMPTS", "10"))


@lru_cache

def get_settings() -> Settings:
    return Settings()
