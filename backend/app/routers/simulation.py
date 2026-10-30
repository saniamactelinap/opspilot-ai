from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pipeline, Incident, RecoveryPlan, AuditLog
from app.schemas import (
    SimulateFailureRequest,
    SimulateFailureResponse,
    IncidentResponse,
)
from app.services.impact_analyzer import calculate_pipeline_impact

router = APIRouter(tags=["Simulation & Incidents"])

# Supported simulation failure profiles with realistic error messages and playbooks
FAILURE_PROFILES: Dict[str, Dict[str, Any]] = {
    "MISSING_PARTITION": {
        "title": lambda name: f"{name} Ingestion Stalled - Missing Partition",
        "error_message": "Partition '2026-10-25/hour=14' missing: upstream event buffer empty.",
        "root_cause": "Upstream webhook ingestion buffer failed to emit records during hourly partition rollover.",
        "suggested_action": "REPLAY_PARTITION_FROM_RAW_STREAM",
        "playbook_steps": (
            "1. Scan raw stream buffer for missing timestamp window.\n"
            "2. Reconstruct staging Parquet partition.\n"
            "3. Rerun transform DAG with partition override.\n"
            "4. Verify target row counts match raw stream."
        ),
    },
    "SCHEMA_MISMATCH": {
        "title": lambda name: f"{name} Transform Failed - Schema Mismatch Detected",
        "error_message": "Schema drift: received column 'customer_tier' of type VARCHAR(255), expected INTEGER.",
        "root_cause": "Upstream CRM release v2.4 altered customer schema definition without backward-compatible database migration.",
        "suggested_action": "APPLY_SCHEMA_ADAPTER_FALLBACK",
        "playbook_steps": (
            "1. Activate schema compatibility shim adapter.\n"
            "2. Cast incompatible column to expected integer representation.\n"
            "3. Route unparseable rows to dead-letter quarantine table.\n"
            "4. Resume downstream aggregation pipeline."
        ),
    },
    "API_TIMEOUT": {
        "title": lambda name: f"{name} Extraction Failed - External API Timeout (504)",
        "error_message": "HTTP 504 Gateway Timeout connecting to external SaaS provider endpoint after 3 retries (30,000ms).",
        "root_cause": "External SaaS API experiencing rate limiting and high packet degradation exceeding retry budget.",
        "suggested_action": "BACKOFF_RETRY_WITH_CACHED_STATE",
        "playbook_steps": (
            "1. Check third-party API status page and verify endpoint reachability.\n"
            "2. Replay batch with exponential backoff strategy.\n"
            "3. Fall back to cached delta snapshot if timeout persists.\n"
            "4. Verify data freshness and completeness."
        ),
    },
}


@router.post("/api/simulate/fail", response_model=SimulateFailureResponse, status_code=status.HTTP_201_CREATED)
def simulate_pipeline_failure(
    request: SimulateFailureRequest,
    db: Session = Depends(get_db),
):
    """
    Simulate a controlled failure scenario on a specified pipeline.
    Validates pipeline existence, supported failure types, and prevents duplicate active incidents.
    Updates pipeline status to FAILED, calculates downstream business blast radius, opens a new Incident,
    and logs the event to the audit trail.
    """
    # 1. Validate failure type
    normalized_type = request.failure_type.upper().strip()
    if normalized_type not in FAILURE_PROFILES:
        valid_types = ", ".join(FAILURE_PROFILES.keys())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid failure type '{request.failure_type}'. Supported types: {valid_types}",
        )

    # 2. Validate pipeline existence
    pipeline = db.query(Pipeline).filter(Pipeline.id == request.pipeline_id).first()
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline with ID {request.pipeline_id} not found.",
        )

    # 3. Prevent duplicate active incidents for the same pipeline
    active_incident = (
        db.query(Incident)
        .filter(Incident.pipeline_id == pipeline.id, Incident.status != "RESOLVED")
        .first()
    )
    if active_incident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pipeline '{pipeline.name}' already has an active incident "
                f"(Incident #{active_incident.id}, status: '{active_incident.status}'). "
                "Resolve or reset the active incident before simulating another failure."
            ),
        )

    profile = FAILURE_PROFILES[normalized_type]
    now = datetime.utcnow()

    # 4. Update pipeline status to FAILED
    pipeline.status = "FAILED"
    pipeline.error_message = profile["error_message"]
    pipeline.last_run_at = now

    # 5. Calculate dynamic business impact
    impact_report = calculate_pipeline_impact(pipeline)

    # 6. Create new Incident
    incident = Incident(
        pipeline_id=pipeline.id,
        title=profile["title"](pipeline.name),
        error_type=normalized_type,
        root_cause=profile["root_cause"],
        severity=impact_report["severity_classification"],
        status="OPEN",
        business_impact_summary=impact_report["severity_rationale"],
        estimated_sla_breach_mins=impact_report["demo_risk_estimate"]["estimated_sla_breach_mins"],
        opened_at=now,
    )
    db.add(incident)
    db.flush()

    # 7. Formulate proposed recovery plan
    recovery_plan = RecoveryPlan(
        incident_id=incident.id,
        action_type=profile["suggested_action"],
        description=f"Automated recovery plan proposed by OpsPilot AI for failure type {normalized_type}.",
        playbook_steps=profile["playbook_steps"],
        risk_level="LOW",
        requires_approval=True,
        status="PENDING_APPROVAL",
    )
    db.add(recovery_plan)

    # 8. Record in audit trail
    audit_entry = AuditLog(
        pipeline_id=pipeline.id,
        incident_id=incident.id,
        action="SIMULATION_FAILURE_TRIGGERED",
        actor="Simulation Engine",
        details=(
            f"Simulated failure '{normalized_type}' injected into pipeline '{pipeline.name}'. "
            f"Incident #{incident.id} opened with severity {incident.severity}. "
            f"Blast radius: {impact_report['affected_assets_count']} assets affected."
        ),
        timestamp=now,
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(pipeline)
    db.refresh(incident)

    return SimulateFailureResponse(
        message=(
            f"Failure simulation successfully applied to '{pipeline.name}'. "
            f"Incident #{incident.id} is now OPEN ({incident.severity} severity)."
        ),
        pipeline=pipeline,
        incident=incident,
        impact_report=impact_report,
    )


@router.get("/api/incidents", response_model=List[IncidentResponse])
def get_all_incidents(db: Session = Depends(get_db)):
    """
    List all incidents currently stored in the database, ordered by newest first.
    """
    incidents = db.query(Incident).order_by(Incident.id.desc()).all()
    return incidents


@router.get("/api/incidents/{incident_id}", response_model=IncidentResponse)
def get_incident_by_id(incident_id: int, db: Session = Depends(get_db)):
    """
    Fetch comprehensive details for a specific incident.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with ID {incident_id} not found.",
        )
    return incident
