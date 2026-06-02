from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey, Text, Enum, JSON, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .db import Base
import enum


class AccessLevel(str, enum.Enum):
    admin = "admin"
    user = "user"


class TranscriptStatus(str, enum.Enum):
    draft = "Draft"
    in_progress = "InProgress"
    completed = "Completed"


class TranscriptionJobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    access_level: Mapped[AccessLevel] = mapped_column(Enum(AccessLevel), default=AccessLevel.user)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    transcripts = relationship("Transcript", back_populates="owner")


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[TranscriptStatus] = mapped_column(Enum(TranscriptStatus), default=TranscriptStatus.draft)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    wav_filename: Mapped[str | None] = mapped_column(String(255))
    wav_storage_path: Mapped[str | None] = mapped_column(String(512))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    dictionary_snapshot: Mapped[dict | None] = mapped_column(JSON)
    exclude_snapshot: Mapped[dict | None] = mapped_column(JSON)

    owner = relationship("User", back_populates="transcripts")
    lines = relationship("TranscriptLine", cascade="all, delete-orphan", back_populates="transcript")
    labels = relationship("SpeakerLabel", cascade="all, delete-orphan", back_populates="transcript")
    transcription_jobs = relationship("TranscriptionJob", cascade="all, delete-orphan", back_populates="transcript")


class TranscriptionJob(Base):
    __tablename__ = "transcription_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(ForeignKey("transcripts.id"), nullable=False)
    status: Mapped[TranscriptionJobStatus] = mapped_column(
        Enum(TranscriptionJobStatus),
        default=TranscriptionJobStatus.queued,
        nullable=False,
    )
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    started_at: Mapped[DateTime | None] = mapped_column(DateTime)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime)

    transcript = relationship("Transcript", back_populates="transcription_jobs")


class TranscriptLine(Base):
    __tablename__ = "transcript_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(ForeignKey("transcripts.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp_hms: Mapped[str] = mapped_column(String(8), nullable=False)
    speaker_label_id: Mapped[int | None] = mapped_column(ForeignKey("speaker_labels.id"))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    flags_json: Mapped[dict | None] = mapped_column(JSON)

    transcript = relationship("Transcript", back_populates="lines")
    speaker_label = relationship("SpeakerLabel")


class SpeakerLabel(Base):
    __tablename__ = "speaker_labels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(ForeignKey("transcripts.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(7), nullable=False, default="#ffffff")

    transcript = relationship("Transcript", back_populates="labels")


class VocabularyEntry(Base):
    __tablename__ = "vocabulary_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_scope: Mapped[str] = mapped_column(String(50), nullable=False)
    transcript_id: Mapped[int | None] = mapped_column(ForeignKey("transcripts.id"))
    word_or_phrase: Mapped[str] = mapped_column(String(255), nullable=False)


class ExcludeEntry(Base):
    __tablename__ = "exclude_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_scope: Mapped[str] = mapped_column(String(50), nullable=False)
    transcript_id: Mapped[int | None] = mapped_column(ForeignKey("transcripts.id"))
    word_or_phrase: Mapped[str] = mapped_column(String(255), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(100))
    target_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
