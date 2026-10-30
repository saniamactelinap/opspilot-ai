from app.models import Pipeline, Incident, RecoveryPlan
from app.services.recovery_engine import generate_recovery_plan
from app.services.verifier import verify_pipeline_recovery


def test_recovery_playbook_generation_for_each_type():
    """
    Requirement 1: Verify a rule-based recovery recommendation is generated
    for each supported failure type with clear rationale and simulated labels.
    """
    # 1. Missing partition
    inc1 = Incident(error_type="MISSING_PARTITION")
    plan1 = generate_recovery_plan(inc1)
    assert plan1["action_type"] == "REPLAY_PARTITION_FROM_RAW_STREAM"
    assert "[Simulated]" in plan1["description"]
    assert "MISSING_PARTITION" in plan1["rationale"]

    # 2. Schema mismatch
    inc2 = Incident(error_type="SCHEMA_MISMATCH")
    plan2 = generate_recovery_plan(inc2)
    assert plan2["action_type"] == "APPLY_SCHEMA_ADAPTER_FALLBACK"
    assert "[Simulated]" in plan2["description"]
    assert "SCHEMA_MISMATCH" in plan2["rationale"]

    # 3. API timeout
    inc3 = Incident(error_type="API_TIMEOUT")
    plan3 = generate_recovery_plan(inc3)
    assert plan3["action_type"] == "BACKOFF_RETRY_WITH_CACHED_STATE"
    assert "[Simulated]" in plan3["description"]
    assert "API_TIMEOUT" in plan3["rationale"]

    # 4. Unknown / Default fallback
    inc4 = Incident(error_type="UNKNOWN_CHAOS")
    plan4 = generate_recovery_plan(inc4)
    assert plan4["action_type"] == "RESTART_PIPELINE_FROM_CHECKPOINT"
    assert "[Simulated]" in plan4["description"]


def test_verifier_checks_and_simulated_failure():
    """
    Requirement 4 & 5: Verify the verifier runs at least 4 checks,
    and simulated failure mode deterministically fails without marking resolved.
    """
    # Success mode
    success_report = verify_pipeline_recovery(simulate_failure=False)
    assert success_report["all_passed"] is True
    assert len(success_report["checks"]) >= 4

    check_names = [c["check_name"] for c in success_report["checks"]]
    assert "Schema Validity" in check_names
    assert "Required-Field Completeness" in check_names
    assert "Duplicate-Record Check" in check_names
    assert "Data Freshness" in check_names

    # Failure mode
    failure_report = verify_pipeline_recovery(simulate_failure=True)
    assert failure_report["all_passed"] is False
    failed_check = next(c for c in failure_report["checks"] if not c["passed"])
    assert "Duplicate-Record" in failed_check["check_name"]
    assert "FAILED" in failed_check["details"]


def test_get_recovery_plan_endpoint(client):
    """
    Verify GET /api/incidents/{id}/recovery-plan returns current proposed plan.
    """
    response = client.get("/api/incidents/1/recovery-plan")
    assert response.status_code == 200
    data = response.json()
    assert data["incident_id"] == 1
    assert data["status"] == "PENDING_APPROVAL"
    assert data["requires_approval"] is True
    assert data["action_type"] == "REPLAY_PARTITION_FROM_RAW_STREAM"


def test_recovery_without_approval_blocked(client, db_session):
    """
    Requirement 2: Recovery must be strictly blocked unless the plan has been approved.
    """
    response = client.post("/api/incidents/1/recover", json={"simulate_verification_failure": False})
    assert response.status_code == 400
    assert "PENDING_APPROVAL" in response.json()["detail"]
    assert "Human approval is strictly required" in response.json()["detail"]

    # Verify pipeline remains FAILED and incident remains OPEN
    pipeline = db_session.query(Pipeline).filter_by(id=1).first()
    assert pipeline.status == "FAILED"
    incident = db_session.query(Incident).filter_by(id=1).first()
    assert incident.status == "OPEN"


def test_rejected_recovery_cannot_execute(client, db_session):
    """
    Requirement 4: Rejected plans must not execute.
    """
    reject_res = client.post(
        "/api/incidents/1/reject",
        json={"rejected_by": "Security Officer", "reason": "Manual partition audit required."},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # Rejecting again should be rejected as duplicate
    duplicate_reject = client.post("/api/incidents/1/reject")
    assert duplicate_reject.status_code == 400
    assert "already been REJECTED" in duplicate_reject.json()["detail"]

    # Attempting to recover on a rejected plan must fail
    recover_res = client.post("/api/incidents/1/recover")
    assert recover_res.status_code == 400
    assert "REJECTED" in recover_res.json()["detail"]
    assert "Human approval is strictly required" in recover_res.json()["detail"]


def test_approved_recovery_success_and_pipeline_healthy(client, db_session):
    """
    Requirement 3 & 6: Approved recovery can complete successfully.
    Pipeline status changes to healthy only after successful verification.
    """
    # 1. Approve recovery plan
    approve_res = client.post(
        "/api/incidents/1/approve",
        json={"approved_by": "Lead Data Engineer"},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "APPROVED"
    assert approve_res.json()["approved_by"] == "Lead Data Engineer"

    # Attempting to approve again should fail
    dup_approve = client.post("/api/incidents/1/approve")
    assert dup_approve.status_code == 400
    assert "already APPROVED" in dup_approve.json()["detail"]

    # 2. Execute recovery workflow
    recover_res = client.post(
        "/api/incidents/1/recover",
        json={"simulate_verification_failure": False, "recovered_by": "OpsPilot Orchestrator"},
    )
    assert recover_res.status_code == 200
    data = recover_res.json()

    assert data["incident_status"] == "RESOLVED"
    assert data["pipeline_status"] == "HEALTHY"
    assert data["plan_status"] == "EXECUTED"
    assert data["verification_report"]["all_passed"] is True
    assert len(data["verification_report"]["checks"]) >= 4

    # 3. Check DB state
    pipeline = db_session.query(Pipeline).filter_by(id=1).first()
    assert pipeline.status == "HEALTHY"
    assert pipeline.error_message is None

    incident = db_session.query(Incident).filter_by(id=1).first()
    assert incident.status == "RESOLVED"
    assert incident.resolved_at is not None


def test_repeated_recovery_blocked_after_resolution(client):
    """
    Requirement 9: Repeated requests must not accidentally execute duplicate recovery operations.
    """
    # First approve and recover successfully
    client.post("/api/incidents/1/approve")
    client.post("/api/incidents/1/recover", json={"simulate_verification_failure": False})

    # Second recovery attempt on resolved incident must fail
    repeat_res = client.post("/api/incidents/1/recover")
    assert repeat_res.status_code == 400
    assert "already RESOLVED" in repeat_res.json()["detail"]


def test_verification_failure_never_resolves_incident(client, db_session):
    """
    Requirement 5: Verification failure must leave the incident unresolved and pipeline failed.
    """
    # Approve plan
    client.post("/api/incidents/1/approve")

    # Recover with simulated verification failure
    recover_res = client.post(
        "/api/incidents/1/recover",
        json={"simulate_verification_failure": True},
    )
    assert recover_res.status_code == 200
    data = recover_res.json()

    assert data["incident_status"] == "VERIFICATION_FAILED"
    assert data["pipeline_status"] == "FAILED"
    assert data["plan_status"] == "FAILED"
    assert data["verification_report"]["all_passed"] is False

    # Check DB directly: Pipeline MUST still be FAILED and Incident MUST NOT be resolved
    pipeline = db_session.query(Pipeline).filter_by(id=1).first()
    assert pipeline.status == "FAILED"
    assert "verification failed" in pipeline.error_message.lower()

    incident = db_session.query(Incident).filter_by(id=1).first()
    assert incident.status == "VERIFICATION_FAILED"
    assert incident.resolved_at is None


def test_audit_logs_chronological_order(client):
    """
    Requirement 7: Audit events are persisted and returned in chronological order.
    """
    # Trigger full lifecycle: approve and recover
    client.post("/api/incidents/1/approve", json={"approved_by": "Test Engineer"})
    client.post("/api/incidents/1/recover", json={"simulate_verification_failure": False})

    # Query incident logs
    res = client.get("/api/incidents/1/logs")
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) >= 5

    actions = [l["action"] for l in logs]
    assert "PIPELINE_FAILED" in actions
    assert "INCIDENT_CREATED" in actions
    assert "RECOVERY_PLAN_APPROVED" in actions
    assert "RECOVERY_STARTED" in actions
    assert "VERIFICATION_PASSED" in actions
    assert "INCIDENT_RESOLVED" in actions

    # Check chronological ordering (timestamps are non-decreasing)
    for i in range(len(logs) - 1):
        assert logs[i]["timestamp"] <= logs[i + 1]["timestamp"]


def test_global_audit_logs_endpoint(client):
    """
    Verify GET /api/audit-logs returns global platform audit trail.
    """
    res = client.get("/api/audit-logs?limit=50")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3
    assert all("action" in entry and "actor" in entry for entry in data)


def test_unknown_incident_errors(client):
    """
    Requirement 8: Unknown incidents return 404 for all endpoints.
    """
    assert client.get("/api/incidents/99999/recovery-plan").status_code == 404
    assert client.post("/api/incidents/99999/approve").status_code == 404
    assert client.post("/api/incidents/99999/reject").status_code == 404
    assert client.post("/api/incidents/99999/recover").status_code == 404
    assert client.get("/api/incidents/99999/logs").status_code == 404
