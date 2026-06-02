from pydantic import BaseModel
from functools import lru_cache
import os
import logging


logger = logging.getLogger("atc.settings")
DEFAULT_DEV_SECRET = "dev-secret-change"
EXAMPLE_SECRET = "change-this-to-a-long-random-secret"
UNSAFE_SECRET_VALUES = {DEFAULT_DEV_SECRET, EXAMPLE_SECRET}


class Settings(BaseModel):
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite+pysqlite:///./atc.db")
    secret_key: str = os.getenv("SECRET_KEY", DEFAULT_DEV_SECRET)
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "atc_session")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    secure_cookies: bool = os.getenv("SECURE_COOKIES", "false").lower() == "true"
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175",
    )
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
    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_local_only: bool = os.getenv("WHISPER_LOCAL_ONLY", "false").lower() == "true"
    whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
    whisper_temperature: float = float(os.getenv("WHISPER_TEMPERATURE", "0"))
    whisper_no_speech_threshold: float = float(os.getenv("WHISPER_NO_SPEECH_THRESHOLD", "0.45"))
    whisper_log_prob_threshold: float = float(os.getenv("WHISPER_LOG_PROB_THRESHOLD", "-0.8"))
    whisper_compression_ratio_threshold: float = float(os.getenv("WHISPER_COMPRESSION_RATIO_THRESHOLD", "2.4"))
    whisper_repetition_penalty: float = float(os.getenv("WHISPER_REPETITION_PENALTY", "1.15"))
    whisper_no_repeat_ngram_size: int = int(os.getenv("WHISPER_NO_REPEAT_NGRAM_SIZE", "3"))
    whisper_vad_min_silence_ms: int = int(os.getenv("WHISPER_VAD_MIN_SILENCE_MS", "500"))
    whisper_vad_speech_pad_ms: int = int(os.getenv("WHISPER_VAD_SPEECH_PAD_MS", "150"))
    whisper_hallucination_silence_threshold: float = float(os.getenv("WHISPER_HALLUCINATION_SILENCE_THRESHOLD", "1.0"))
    whisper_hotwords_enabled: bool = os.getenv("WHISPER_HOTWORDS_ENABLED", "false").lower() == "true"
    whisper_ffmpeg_denoise: bool = os.getenv("WHISPER_FFMPEG_DENOISE", "false").lower() == "true"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def validate_security(self) -> None:
        if self.is_production:
            problems = []
            if self.secret_key in UNSAFE_SECRET_VALUES or len(self.secret_key) < 32:
                problems.append("SECRET_KEY must be set to a strong random value")
            if not self.secure_cookies:
                problems.append("SECURE_COOKIES=true is required behind HTTPS")
            if any(origin == "*" for origin in self.allowed_cors_origins):
                problems.append("CORS_ORIGINS must not include *")
            if problems:
                raise RuntimeError("Unsafe production settings: " + "; ".join(problems))
            return

        if self.secret_key in UNSAFE_SECRET_VALUES:
            logger.warning("Using an unsafe development SECRET_KEY. Set SECRET_KEY before using real recordings.")


@lru_cache

def get_settings() -> Settings:
    return Settings()
