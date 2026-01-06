from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from .models import TranscriptStatus, AccessLevel


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
    id: int
    name: str
    email: EmailStr
    access_level: AccessLevel
    active: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    user_id: int
    password: str


class TranscriptCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TranscriptOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_user_id: int
    status: TranscriptStatus
    wav_filename: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class TranscriptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TranscriptStatus] = None


class TranscriptLineOut(BaseModel):
    id: int
    order_index: int
    timestamp_hms: str
    speaker_label_id: Optional[int]
    text: str
    flags_json: Optional[dict]

    class Config:
        from_attributes = True


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
    id: int
    name: str
    color_hex: str

    class Config:
        from_attributes = True


class SpeakerLabelCreate(BaseModel):
    name: str
    color_hex: str


class SpeakerLabelUpdate(BaseModel):
    name: Optional[str] = None
    color_hex: Optional[str] = None


class EntryOut(BaseModel):
    id: int
    word_or_phrase: str

    class Config:
        from_attributes = True


class EntryCreate(BaseModel):
    word_or_phrase: str


class StartTranscriptionRequest(BaseModel):
    start_time: str = Field(pattern=r"^\d{2}:\d{2}:\d{2}$")


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
    id: int
    action: str
    target_type: Optional[str]
    target_id: Optional[int]
    created_at: str
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True
