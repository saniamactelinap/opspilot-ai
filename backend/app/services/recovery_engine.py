from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import Incident, RecoveryPlan, Pipeline
from app.services.verifier import verify_pipeline_recovery
from app.services.audit_service import record_audit_event


# Rule-based deterministic recovery recommendation matrix
RECOVERY_PLAYBOOKS: Dict[str, Dict[str, str]] = {
    "MISSING_PARTITION": {
        "action_type": "REPLAY_PARTITION_FROM_RAW_STREAM",
        "description": "[Simulated] Replay and reconstruct missing partition from raw stream buffer.",
        "rationale": (
            "Failure classified as MISSING_PARTITION. Re-reading the raw event lake for the affected "
            "hourly window safely reconstructs the missing partition without side-effects or full-table reloads."
        ),
        "playbook_steps": (
            "[Simulated Recovery Playbook]\n"
            "1. Scan raw Kafka/S3 ingestion buffer for missing hour timestamp offset.\n"
            "2. Reconstruct staging Parquet partition with validated schema.\n"
            "3. Execute targeted backfill transform with partition override flag.\n"
            "4. Trigger automated data quality verifier."
        ),
    },
    "SCHEMA_MISMATCH": {
        "action_type": "APPLY_SCHEMA_ADAPTER_FALLBACK",
        "description": "[Simulated] Validate schema contract, apply compatibility adapter, and isolate drift columns.",
        "rationale": (
            "Failure classified as SCHEMA_MISMATCH. Applying a compatibility mapping adapter safely "
            "coerces newly introduced column types and isolates unparseable rows into a quarantine table."
        ),
        "playbook_steps": (
            "[Simulated Recovery Playbook]\n"
            "1. Validate incoming schema diff against registered schema contract v2.1.\n"
            "2. Activate schema compatibility shim adapter for type coercion.\n"
            "3. Route non-conforming rows to quarantine dead-letter storage.\n"
            "4. Trigger automated data quality verifier."
        ),
    },
    "API_TIMEOUT": {
        "action_type": "BACKOFF_RETRY_WITH_CACHED_STATE",
        "description": "[Simulated] Retry external source with exponential backoff and delta checkpointing.",
        "rationale": (
            "Failure classified as API_TIMEOUT. Upstream SaaS provider experienced transient latency. "
            "Retrying with exponential backoff and delta polling avoids duplicate ingestion and recovers cleanly."
        ),
        "playbook_steps": (
            "[Simulated Recovery Playbook]\n"
            "1. Probe external SaaS endpoint health and rate limit header metrics.\n"
            "2. Execute retry request with exponential backoff strategy (2s, 4s, 8s).\n"
            "3. Rehydrate from latest delta checkpoint to avoid full rescan.\n"
            "4. Trigger automated data quality verifier."
        ),
    },
}

DEFAULT_PLAYBOOK: Dict[str, str] = {
    "action_type": "RESTART_PIPELINE_FROM_CHECKPOINT",
    "description": "[Simulated] Clear stale worker locks and restart pipeline from latest committed checkpoint.",
    "rationale": (
        "General operational recovery playbook. Safely clears stale execution locks and resumes "
        "transform processing from the last verified checkpoint."
    ),
    "playbook_steps": (
        "[Simulated Recovery Playbook]\n"
        "1. Clear stale task worker locks in metadata store.\n"
        "2. Rewind pipeline state to latest committed checkpoint.\n"
        "3. Resume downstream pipeline execution.\n"
        "4. Trigger automated data quality verifier."
    ),
}


def generate_recovery_plan(incident: Incident) -> Dict[str, str]:
    """
    Generates a rule-based recovery recommendation for an incident based on its failure type.
    Note: All actions are deterministic simulations generated via rule-based heuristic matrix.
    No external services or paid LLMs are invoked.
    """
    error_type = (incident.error_type or "").upper().strip()
    return RECOVERY_PLAYBOOKS.get(error_type, DEFAULT_PLAYBOOK)


def approve_recovery_plan(
    db: Session,
    incident_id: int,
    approved_by: Optional[str] = "Operations Engineer",
) -> RecoveryPlan:
    """
    Approves a proposed recovery plan for execution.
    Enforces state machine guards preventing invalid or duplicate approvals.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found.",
        )

    if incident.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve recovery: Incident #{incident_id} is already RESOLVED.",
        )

    if incident.status in ["RECOVERING", "VERIFYING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve recovery: Incident #{incident_id} is currently in state '{incident.status}'.",
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

    if plan.status == "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recovery plan #{plan.id} is already APPROVED.",
        )

    approver = approved_by or "Operations Engineer"
    now = datetime.utcnow()

    plan.status = "APPROVED"
    plan.approved_by = approver
    plan.approved_at = now
    incident.status = "APPROVED"

    record_audit_event(
        db=db,
        action="RECOVERY_PLAN_APPROVED",
        actor=approver,
        details=f"Recovery Plan #{plan.id} ({plan.action_type}) approved by {approver}. Ready for execution.",
        incident_id=incident.id,
        pipeline_id=incident.pipeline_id,
    )

    db.commit()
    db.refresh(plan)
    return plan


def reject_recovery_plan(
    db: Session,
    incident_id: int,
    rejected_by: Optional[str] = "Operations Engineer",
    reason: Optional[str] = "Manual investigation required; automated playbook rejected.",
) -> RecoveryPlan:
    """
    Rejects a proposed recovery plan, blocking any subsequent execution.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found.",
        )

    if incident.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject recovery: Incident #{incident_id} is already RESOLVED.",
        )

    if incident.status in ["RECOVERING", "VERIFYING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject recovery: Incident #{incident_id} is currently in state '{incident.status}'.",
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

    if plan.status == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recovery plan #{plan.id} has already been REJECTED.",
        )

    rejector = rejected_by or "Operations Engineer"
    rejection_reason = reason or "Manual triage requested."

    plan.status = "REJECTED"
    incident.status = "REJECTED"

    record_audit_event(
        db=db,
        action="RECOVERY_PLAN_REJECTED",
        actor=rejector,
        details=f"Recovery Plan #{plan.id} rejected by {rejector}. Reason: {rejection_reason}",
        incident_id=incident.id,
        pipeline_id=incident.pipeline_id,
    )

    db.commit()
    db.refresh(plan)
    return plan


def execute_recovery_workflow(
    db: Session,
    incident_id: int,
    simulate_verification_failure: bool = False,
    actor: Optional[str] = "OpsPilot Orchestrator",
) -> Dict[str, Any]:
    """
    Executes an approved simulated recovery workflow through the state machine:
    APPROVED -> RECOVERING -> VERIFYING -> RESOLVED (or VERIFICATION_FAILED)
    
    Guards:
    - Recovery is strictly blocked unless the plan is APPROVED.
    - Rejected plans cannot be executed.
    - Resolved incidents cannot be recovered again.
    - Repeated/concurrent execution requests are rejected.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found.",
        )

    if incident.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incident #{incident_id} is already RESOLVED. Cannot re-execute recovery.",
        )

    if incident.status in ["RECOVERING", "VERIFYING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recovery is already currently in progress for Incident #{incident_id} (state: {incident.status}).",
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

    # Human-in-the-loop approval check
    if plan.status != "APPROVED":
        if plan.status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Recovery blocked: Plan #{plan.id} was REJECTED. Human approval is strictly required before execution.",
            )
        if plan.status == "PENDING_APPROVAL":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Recovery blocked: Plan #{plan.id} is PENDING_APPROVAL. Human approval is strictly required before execution.",
            )
        if plan.status == "EXECUTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Recovery blocked: Plan #{plan.id} has already been EXECUTED.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recovery blocked: Plan status is '{plan.status}'. Plan must be APPROVED before execution.",
        )

    pipeline = db.query(Pipeline).filter(Pipeline.id == incident.pipeline_id).first()
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent pipeline with ID {incident.pipeline_id} not found.",
        )

    orchestrator = actor or "OpsPilot Orchestrator"
    now = datetime.utcnow()

    # Step 1: Transition to RECOVERING
    incident.status = "RECOVERING"
    pipeline.status = "RECOVERING"
    record_audit_event(
        db=db,
        action="RECOVERY_STARTED",
        actor=orchestrator,
        details=f"Starting simulated recovery playbook '{plan.action_type}' for {incident.error_type}.",
        incident_id=incident.id,
        pipeline_id=pipeline.id,
    )

    # Step 2: Transition to VERIFYING
    incident.status = "VERIFYING"
    record_audit_event(
        db=db,
        action="VERIFICATION_STARTED",
        actor="OpsPilot Verifier",
        details="Running automated post-recovery data quality and schema invariant checks.",
        incident_id=incident.id,
        pipeline_id=pipeline.id,
    )

    # Step 3: Run automated verification checks
    verification_report = verify_pipeline_recovery(simulate_failure=simulate_verification_failure)

    # Step 4: Resolve or halt based on verification results
    if verification_report["all_passed"]:
        plan.status = "EXECUTED"
        incident.status = "RESOLVED"
        incident.resolved_at = now
        pipeline.status = "HEALTHY"
        pipeline.error_message = None
        pipeline.last_run_at = now

        record_audit_event(
            db=db,
            action="VERIFICATION_PASSED",
            actor="OpsPilot Verifier",
            details=f"All 4 verification checks passed: {verification_report['summary']}",
            incident_id=incident.id,
            pipeline_id=pipeline.id,
        )
        record_audit_event(
            db=db,
            action="INCIDENT_RESOLVED",
            actor=orchestrator,
            details=f"Incident #{incident.id} marked RESOLVED. Pipeline '{pipeline.name}' restored to HEALTHY.",
            incident_id=incident.id,
            pipeline_id=pipeline.id,
        )
        message = (
            f"Recovery successfully executed and verified for '{pipeline.name}'. "
            f"Incident #{incident.id} is now RESOLVED and pipeline is HEALTHY."
        )
    else:
        plan.status = "FAILED"
        incident.status = "VERIFICATION_FAILED"
        pipeline.status = "FAILED"  # Pipeline remains FAILED!
        pipeline.error_message = f"Post-recovery verification failed: {verification_report['summary']}"

        record_audit_event(
            db=db,
            action="VERIFICATION_FAILED",
            actor="OpsPilot Verifier",
            details=f"Verification invariant violation: {verification_report['summary']}",
            incident_id=incident.id,
            pipeline_id=pipeline.id,
        )
        record_audit_event(
            db=db,
            action="RECOVERY_FAILED",
            actor=orchestrator,
            details=(
                f"Incident #{incident.id} remains UNRESOLVED due to verification failure. "
                f"Pipeline '{pipeline.name}' remains FAILED."
            ),
            incident_id=incident.id,
            pipeline_id=pipeline.id,
        )
        message = (
            f"Recovery execution halted during verification for '{pipeline.name}'. "
            f"Incident #{incident.id} remains UNRESOLVED and pipeline remains FAILED."
        )

    db.commit()
    db.refresh(incident)
    db.refresh(pipeline)
    db.refresh(plan)

    return {
        "message": message,
        "incident_id": incident.id,
        "pipeline_id": pipeline.id,
        "incident_status": incident.status,
        "pipeline_status": pipeline.status,
        "plan_status": plan.status,
        "verification_report": verification_report,
    }
