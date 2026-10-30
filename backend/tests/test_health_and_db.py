from app.models import Pipeline, DownstreamAsset, Incident, RecoveryPlan, AuditLog
from app.seed_data import seed_database


def test_read_root(client):
    """
    Verify root endpoint provides API metadata and links.
    """
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "OpsPilot AI"
    assert data["status"] == "online"
    assert "health_check" in data


def test_health_endpoint(client):
    """
    Verify GET /api/health returns ok status and verifies database connection.
    """
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "OpsPilot AI"
    assert data["database"] == "connected"
    assert data["pipelines_count"] == 3


def test_pipelines_seeded(db_session):
    """
    Verify the three required demo pipelines exist with correct statuses.
    """
    pipelines = db_session.query(Pipeline).all()
    assert len(pipelines) == 3

    # Check the failed Sales & Revenue ETL pipeline
    failed_pipeline = db_session.query(Pipeline).filter_by(pipeline_key="sales-revenue-etl").first()
    assert failed_pipeline is not None
    assert failed_pipeline.status == "FAILED"
    assert "missing" in failed_pipeline.error_message.lower()

    # Check the healthy Customer Activity Stream pipeline
    cust_pipeline = db_session.query(Pipeline).filter_by(pipeline_key="customer-activity-stream").first()
    assert cust_pipeline is not None
    assert cust_pipeline.status == "HEALTHY"
    assert cust_pipeline.error_message is None

    # Check the healthy Inventory Sync pipeline
    inv_pipeline = db_session.query(Pipeline).filter_by(pipeline_key="inventory-warehouse-sync").first()
    assert inv_pipeline is not None
    assert inv_pipeline.status == "HEALTHY"
    assert inv_pipeline.error_message is None


def test_downstream_assets_relationship(db_session):
    """
    Verify downstream business assets are mapped to their parent pipeline.
    """
    sales_pipeline = db_session.query(Pipeline).filter_by(pipeline_key="sales-revenue-etl").first()
    assert sales_pipeline is not None
    assert len(sales_pipeline.downstream_assets) == 3

    asset_names = [a.name for a in sales_pipeline.downstream_assets]
    assert "Executive Revenue Briefing" in asset_names
    assert "Sales Commission Dashboard" in asset_names
    assert "Daily Stripe Reconciliation" in asset_names

    # Check criticality on the executive briefing
    exec_report = next(a for a in sales_pipeline.downstream_assets if a.name == "Executive Revenue Briefing")
    assert exec_report.criticality == "CRITICAL"
    assert exec_report.business_unit == "Executive Leadership"


def test_incident_and_recovery_plan(db_session):
    """
    Verify active incident and pending recovery plan are created for the failed pipeline.
    """
    sales_pipeline = db_session.query(Pipeline).filter_by(pipeline_key="sales-revenue-etl").first()
    assert len(sales_pipeline.incidents) >= 1

    incident = sales_pipeline.incidents[0]
    assert incident.status == "OPEN"
    assert incident.severity == "CRITICAL"
    assert incident.error_type == "MISSING_PARTITION"

    # Verify recovery plan requires human approval
    assert len(incident.recovery_plans) >= 1
    plan = incident.recovery_plans[0]
    assert plan.requires_approval is True
    assert plan.status == "PENDING_APPROVAL"
    assert plan.action_type == "REPLAY_PARTITION_FROM_RAW_STREAM"

    # Verify audit trail exists
    assert len(sales_pipeline.audit_logs) >= 1


def test_idempotent_seeding(db_session):
    """
    Verify re-running seed_database does not create duplicate pipelines.
    """
    initial_count = db_session.query(Pipeline).count()
    result = seed_database(db_session)

    assert result["seeded"] is False
    assert "already contains" in result["message"]
    assert db_session.query(Pipeline).count() == initial_count
