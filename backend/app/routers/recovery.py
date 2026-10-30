from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Incident, RecoveryPlan
from app.schemas import (
    RecoveryPlanResponse,
    ApprovePlanRequest,
    RejectPlanRequest,
    RecoverRequest,
    RecoveryExecutionResponse,
)
from app.services.recovery_engine import (
    approve_recovery_plan,
    reject_recovery_plan,
    execute_recovery_workflow,
)

router = APIRouter(tags=["Recovery & Approval"])


@router.get(
    "/api/incidents/{incident_id}/recovery-plan",
    response_model=RecoveryPlanResponse,
)
def get_incident_recovery_plan(incident_id: int, db: Session = Depends(get_db)):
    """
    Retrieve the current proposed recovery plan for a specific incident.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found.",
        )

    plan = (
        db.query(RecoveryPlan)
        .filter(RecoveryPlan.incident_id == incident.id)
        .order_by(RecoveryPlan.id.desc())
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No recovery plan found for Incident #{incident_id}.",
        )
    return plan


@router.post(
    "/api/incidents/{incident_id}/approve",
    response_model=RecoveryPlanResponse,
)
def approve_plan_endpoint(
    incident_id: int,
    request: ApprovePlanRequest = ApprovePlanRequest(),
    db: Session = Depends(get_db),
):
    """
    Human-in-the-loop approval endpoint.
    Transitions plan status to APPROVED, enabling the recovery workflow to execute.
    """
    return approve_recovery_plan(
        db=db,
        incident_id=incident_id,
        approved_by=request.approved_by,
    )


@router.post(
    "/api/incidents/{incident_id}/reject",
    response_model=RecoveryPlanResponse,
)
def reject_plan_endpoint(
    incident_id: int,
    request: RejectPlanRequest = RejectPlanRequest(),
    db: Session = Depends(get_db),
):
    """
    Human-in-the-loop rejection endpoint.
    Transitions plan and incident status to REJECTED, blocking automated recovery.
    """
    return reject_recovery_plan(
        db=db,
        incident_id=incident_id,
        rejected_by=request.rejected_by,
        reason=request.reason,
    )


@router.post(
    "/api/incidents/{incident_id}/recover",
    response_model=RecoveryExecutionResponse,
)
def recover_incident_endpoint(
    incident_id: int,
    request: RecoverRequest = RecoverRequest(),
    db: Session = Depends(get_db),
):
    """
    Executes the approved recovery playbook.
    Orchestrates the state machine:
    APPROVED -> RECOVERING -> VERIFYING -> RESOLVED (or VERIFICATION_FAILED).
    
    Strictly blocked if plan has not been human-approved.
    Runs automated verification checks before resolving incident.
    """
    result = execute_recovery_workflow(
        db=db,
        incident_id=incident_id,
        simulate_verification_failure=request.simulate_verification_failure,
        actor=request.recovered_by,
    )
    return result
