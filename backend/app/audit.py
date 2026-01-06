from sqlalchemy.orm import Session
from .models import AuditLog


def log_event(db: Session, actor_user_id: int | None, action: str, target_type: str | None = None,
              target_id: int | None = None, metadata: dict | None = None) -> None:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=metadata,
    )
    db.add(entry)
    db.commit()
