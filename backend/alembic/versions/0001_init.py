"""init

Revision ID: 0001_init
Revises: 
Create Date: 2024-07-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("access_level", sa.Enum("admin", "user", name="accesslevel"), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "transcripts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("owner_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.Enum("Draft", "InProgress", "Completed", name="transcriptstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("wav_filename", sa.String(length=255)),
        sa.Column("wav_storage_path", sa.String(length=512)),
        sa.Column("duration_seconds", sa.Integer),
        sa.Column("dictionary_snapshot", sa.JSON),
        sa.Column("exclude_snapshot", sa.JSON),
    )
    op.create_table(
        "speaker_labels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("transcript_id", sa.Integer, sa.ForeignKey("transcripts.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("color_hex", sa.String(length=7), nullable=False),
    )
    op.create_table(
        "transcript_lines",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("transcript_id", sa.Integer, sa.ForeignKey("transcripts.id"), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("timestamp_hms", sa.String(length=8), nullable=False),
        sa.Column("speaker_label_id", sa.Integer, sa.ForeignKey("speaker_labels.id")),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("flags_json", sa.JSON),
    )
    op.create_table(
        "vocabulary_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_scope", sa.String(length=50), nullable=False),
        sa.Column("transcript_id", sa.Integer, sa.ForeignKey("transcripts.id")),
        sa.Column("word_or_phrase", sa.String(length=255), nullable=False),
    )
    op.create_table(
        "exclude_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_scope", sa.String(length=50), nullable=False),
        sa.Column("transcript_id", sa.Integer, sa.ForeignKey("transcripts.id")),
        sa.Column("word_or_phrase", sa.String(length=255), nullable=False),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("actor_user_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(length=255), nullable=False),
        sa.Column("target_type", sa.String(length=100)),
        sa.Column("target_id", sa.Integer),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("metadata_json", sa.JSON),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("exclude_entries")
    op.drop_table("vocabulary_entries")
    op.drop_table("transcript_lines")
    op.drop_table("speaker_labels")
    op.drop_table("transcripts")
    op.drop_table("users")
