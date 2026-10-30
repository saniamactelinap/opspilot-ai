from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Incident
from app.schemas import AuditLogResponse
from app.services.audit_service import get_incident_audit_logs, get_all_audit_logs

router = APIRouter(tags=["Audit Logs"])


@router.get(
    "/api/incidents/{incident_id}/logs",
    response_model=List[AuditLogResponse],
)
def get_logs_for_incident(incident_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all audit log events for a specific incident in chronological order.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found.",
        )
    return get_incident_audit_logs(db=db, incident_id=incident_id)


@router.get(
    "/api/audit-logs",
    response_model=List[AuditLogResponse],
)
def get_global_audit_logs(
    limit: int = Query(default=100, ge=1, le=1000, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """
    Retrieve the global chronological audit log trail of all pipeline failures,
    incident triage actions, human approvals, recoveries, and verification checks.
    """
    return get_all_audit_logs(db=db, limit=limit)
