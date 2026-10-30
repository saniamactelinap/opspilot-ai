from app.models import Pipeline, Incident, AuditLog


def test_get_all_pipelines(client):
    """
    Test listing all pipelines returns seeded items with accurate statuses.
    """
    response = client.get("/api/pipelines")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3

    keys = [p["pipeline_key"] for p in data]
    assert "sales-revenue-etl" in keys
    assert "customer-activity-stream" in keys
    assert "inventory-warehouse-sync" in keys

    sales = next(p for p in data if p["pipeline_key"] == "sales-revenue-etl")
    assert sales["status"] == "FAILED"
    assert len(sales["downstream_assets"]) == 3


def test_get_pipeline_by_id_success(client):
    """
    Test fetching an existing pipeline by its ID.
    """
    response = client.get("/api/pipelines/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["name"] == "Sales & Revenue ETL"
    assert len(data["downstream_assets"]) == 3


def test_get_pipeline_by_id_not_found(client):
    """
    Test 404 error handling for non-existent pipeline ID.
    """
    response = client.get("/api/pipelines/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_pipeline_impact_calculation(client):
    """
    Test downstream blast radius calculation for Sales & Revenue ETL.
    Verifies dynamic counting, severity classification rules, and demo risk estimates.
    """
    response = client.get("/api/pipelines/1/impact")
    assert response.status_code == 200
    data = response.json()

    assert data["pipeline_id"] == 1
    assert data["pipeline_name"] == "Sales & Revenue ETL"
    assert data["affected_assets_count"] == 3
    assert len(data["affected_assets"]) == 3

    # Check affected teams
    assert "Executive Leadership" in data["affected_business_teams"]
    assert "Sales Operations" in data["affected_business_teams"]
    assert "Accounting & Finance" in data["affected_business_teams"]

    # Criticality and severity assignment
    assert data["criticality_breakdown"]["CRITICAL"] >= 1
    assert data["severity_classification"] == "CRITICAL"
    assert "CRITICAL severity" in data["severity_rationale"]

    # Demo risk estimate check
    risk = data["demo_risk_estimate"]
    assert risk["is_illustrative"] is True
    assert "ILLUSTRATIVE DEMO ESTIMATE ONLY" in risk["disclaimer"]
    assert risk["estimated_sla_breach_mins"] == 90
    assert risk["illustrative_financial_risk_usd"] > 0
    assert "Formula:" in risk["calculation_basis"]


def test_get_healthy_pipeline_impact(client):
    """
    Test impact calculation on a healthy pipeline without critical assets.
    """
    response = client.get("/api/pipelines/2/impact")
    assert response.status_code == 200
    data = response.json()

    assert data["pipeline_id"] == 2
    assert data["affected_assets_count"] == 2
    assert data["criticality_breakdown"]["CRITICAL"] == 0
    assert data["severity_classification"] == "HIGH"
    assert "HIGH severity" in data["severity_rationale"]


def test_get_pipeline_impact_not_found(client):
    """
    Test 404 error when calculating impact for a non-existent pipeline.
    """
    response = client.get("/api/pipelines/99999/impact")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_simulate_failure_success(client, db_session):
    """
    Test triggering a simulated SCHEMA_MISMATCH failure on a healthy pipeline.
    """
    payload = {
        "pipeline_id": 2,
        "failure_type": "SCHEMA_MISMATCH",
    }
    response = client.post("/api/simulate/fail", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "successfully applied" in data["message"]

    # Verify pipeline state updated
    pipeline_data = data["pipeline"]
    assert pipeline_data["id"] == 2
    assert pipeline_data["status"] == "FAILED"
    assert "schema drift" in pipeline_data["error_message"].lower()

    # Verify incident created
    incident_data = data["incident"]
    assert incident_data["pipeline_id"] == 2
    assert incident_data["error_type"] == "SCHEMA_MISMATCH"
    assert incident_data["status"] == "OPEN"
    assert incident_data["severity"] == "HIGH"

    # Verify impact report returned in response
    impact = data["impact_report"]
    assert impact["pipeline_id"] == 2
    assert impact["affected_assets_count"] == 2

    # Verify audit log recorded
    audit = db_session.query(AuditLog).filter_by(pipeline_id=2, action="SIMULATION_FAILURE_TRIGGERED").first()
    assert audit is not None
    assert audit.actor == "Simulation Engine"
    assert "SCHEMA_MISMATCH" in audit.details


def test_simulate_failure_api_timeout(client):
    """
    Test triggering a simulated API_TIMEOUT failure on pipeline 3.
    """
    payload = {
        "pipeline_id": 3,
        "failure_type": "API_TIMEOUT",
    }
    response = client.post("/api/simulate/fail", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["incident"]["error_type"] == "API_TIMEOUT"
    assert data["pipeline"]["status"] == "FAILED"
    assert "504" in data["pipeline"]["error_message"]


def test_simulate_failure_invalid_pipeline_id(client):
    """
    Test 404 error when attempting to simulate failure on non-existent pipeline.
    """
    payload = {
        "pipeline_id": 99999,
        "failure_type": "MISSING_PARTITION",
    }
    response = client.post("/api/simulate/fail", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_simulate_failure_invalid_type(client):
    """
    Test 400 error when sending an unsupported failure type.
    """
    payload = {
        "pipeline_id": 2,
        "failure_type": "DATA_CENTER_ON_FIRE",
    }
    response = client.post("/api/simulate/fail", json=payload)
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "Invalid failure type" in detail
    assert "MISSING_PARTITION" in detail
    assert "SCHEMA_MISMATCH" in detail
    assert "API_TIMEOUT" in detail


def test_prevent_duplicate_active_incident(client):
    """
    Test that triggering a failure on a pipeline that already has an active
    (unresolved) incident is rejected with HTTP 400 to prevent duplicate active incidents.
    """
    # Pipeline 1 already has an active Incident #1 from seed data
    payload = {
        "pipeline_id": 1,
        "failure_type": "MISSING_PARTITION",
    }
    response = client.post("/api/simulate/fail", json=payload)
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "already has an active incident" in detail


def test_get_all_incidents(client):
    """
    Test listing all incidents stored in the database.
    """
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["status"] == "OPEN"
    assert "pipeline_id" in data[0]


def test_get_incident_by_id_success(client):
    """
    Test fetching a specific incident by its ID.
    """
    response = client.get("/api/incidents/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["severity"] == "CRITICAL"
    assert data["error_type"] == "MISSING_PARTITION"


def test_get_incident_by_id_not_found(client):
    """
    Test 404 response for non-existent incident ID.
    """
    response = client.get("/api/incidents/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
