from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import AuditLog


def record_audit_event(
    db: Session,
    action: str,
    actor: str,
    details: str,
    incident_id: Optional[int] = None,
    pipeline_id: Optional[int] = None,
) -> AuditLog:
    """
    Records an application-level timestamped audit event into the database.
    Provides full visibility across incident lifecycle, approvals, recovery steps, and verification.
    """
    entry = AuditLog(
        action=action,
        actor=actor,
        details=details,
        incident_id=incident_id,
        pipeline_id=pipeline_id,
        timestamp=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()
    return entry


def get_incident_audit_logs(db: Session, incident_id: int) -> List[AuditLog]:
    """
    Retrieves all audit log records for a specific incident in chronological order.
    """
    return (
        db.query(AuditLog)
        .filter(AuditLog.incident_id == incident_id)
        .order_by(AuditLog.timestamp.asc(), AuditLog.id.asc())
        .all()
    )


def get_all_audit_logs(db: Session, limit: int = 100) -> List[AuditLog]:
    """
    Retrieves the global operational audit log stream in chronological order.
    """
    return (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.asc(), AuditLog.id.asc())
        .limit(limit)
        .all()
    )
