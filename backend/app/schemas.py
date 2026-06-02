from pydantic import BaseModel, ConfigDict, Field, EmailStr
from datetime import datetime
from typing import Optional
from .models import TranscriptStatus, AccessLevel, TranscriptionJobStatus


class UserListItem(BaseModel):
    id: int
    name: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    access_level: AccessLevel = AccessLevel.user


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    access_level: Optional[AccessLevel] = None
    active: Optional[bool] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    access_level: AccessLevel
    active: bool


class LoginRequest(BaseModel):
    user_id: int
    password: str


class TranscriptCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TranscriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    owner_user_id: int
    status: TranscriptStatus
    wav_filename: Optional[str]
    created_at: datetime


class TranscriptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TranscriptStatus] = None


class TranscriptLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_index: int
    timestamp_hms: str
    speaker_label_id: Optional[int]
    text: str
    flags_json: Optional[dict]


class TranscriptLineCreate(BaseModel):
    order_index: int
    timestamp_hms: str = Field(pattern=r"^\d{2}:\d{2}:\d{2}$")
    speaker_label_id: Optional[int] = None
    text: str


class TranscriptLineUpdate(BaseModel):
    order_index: Optional[int] = None
    timestamp_hms: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}:\d{2}$")
    speaker_label_id: Optional[int] = None
    text: Optional[str] = None
    flags_json: Optional[dict] = None


class SpeakerLabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color_hex: str


class SpeakerLabelCreate(BaseModel):
    name: str
    color_hex: str


class SpeakerLabelUpdate(BaseModel):
    name: Optional[str] = None
    color_hex: Optional[str] = None


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    word_or_phrase: str


class EntryCreate(BaseModel):
    word_or_phrase: str


class StartTranscriptionRequest(BaseModel):
    start_time: str = Field(pattern=r"^\d{2}:\d{2}:\d{2}$")


class TranscriptionJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transcript_id: int
    status: TranscriptionJobStatus
    progress: int
    error: Optional[str]
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class SplitLineRequest(BaseModel):
    line_id: int
    split_index: int


class MergeLinesRequest(BaseModel):
    first_line_id: int
    second_line_id: int
    keep_label_id: Optional[int] = None


class ExportResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    user_id: int


class ResetPasswordRequest(BaseModel):
    new_password: str


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    target_type: Optional[str]
    target_id: Optional[int]
    created_at: datetime
    metadata_json: Optional[dict]
