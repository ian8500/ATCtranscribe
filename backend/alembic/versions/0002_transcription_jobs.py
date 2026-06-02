"""add transcription jobs

Revision ID: 0002_transcription_jobs
Revises: 0001_init
Create Date: 2026-06-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_transcription_jobs"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transcription_jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("transcript_id", sa.Integer, sa.ForeignKey("transcripts.id"), nullable=False),
        sa.Column("status", sa.Enum("queued", "running", "completed", "failed", name="transcriptionjobstatus"), nullable=False),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime),
        sa.Column("completed_at", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("transcription_jobs")
