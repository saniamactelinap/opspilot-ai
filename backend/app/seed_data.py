from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Pipeline, DownstreamAsset, Incident, RecoveryPlan, AuditLog


def seed_database(db: Session, force: bool = False) -> dict:
    """
    Seeds the SQLite database with realistic data engineering pipelines,
    downstream business assets, and an active incident for demonstration.
    Idempotent: will not create duplicate entries if data is already present.
    """
    existing_count = db.query(Pipeline).count()
    if existing_count > 0 and not force:
        return {
            "seeded": False,
            "message": f"Database already contains {existing_count} pipelines. Skipping duplicate seeding.",
            "pipelines_count": existing_count,
        }

    now = datetime.utcnow()

    # -------------------------------------------------------------------------
    # Pipeline 1: Sales & Revenue ETL (FAILED)
    # -------------------------------------------------------------------------
    sales_pipeline = db.query(Pipeline).filter_by(pipeline_key="sales-revenue-etl").first()
    if not sales_pipeline:
        sales_pipeline = Pipeline(
            name="Sales & Revenue ETL",
            pipeline_key="sales-revenue-etl",
            description="Ingests POS transactions, Stripe payment events, and invoices to compute hourly revenue metrics.",
            status="FAILED",
            schedule="Hourly (at :00)",
            last_run_at=now - timedelta(minutes=45),
            error_message="Partition '2026-10-25/hour=13' missing: upstream POS payment gateway webhook buffer empty.",
        )
        db.add(sales_pipeline)
        db.flush()

        # Downstream Business Assets for Sales ETL
        assets = [
            DownstreamAsset(
                pipeline_id=sales_pipeline.id,
                name="Executive Revenue Briefing",
                asset_type="BI_REPORT",
                business_unit="Executive Leadership",
                criticality="CRITICAL",
                sla_threshold_hours=1,
                description="Daily revenue brief delivered to CEO, CFO, and VP Finance before morning standup.",
            ),
            DownstreamAsset(
                pipeline_id=sales_pipeline.id,
                name="Sales Commission Dashboard",
                asset_type="DASHBOARD",
                business_unit="Sales Operations",
                criticality="HIGH",
                sla_threshold_hours=4,
                description="Calculates sales reps quarterly commissions and attainment pacing.",
            ),
            DownstreamAsset(
                pipeline_id=sales_pipeline.id,
                name="Daily Stripe Reconciliation",
                asset_type="AUDIT_SYSTEM",
                business_unit="Accounting & Finance",
                criticality="HIGH",
                sla_threshold_hours=2,
                description="Audits merchant fees, gateway payouts, and chargeback discrepancy flags.",
            ),
        ]
        db.add_all(assets)

        # Active Incident for the Failed Pipeline
        sales_incident = Incident(
            pipeline_id=sales_pipeline.id,
            title="Sales ETL Hourly Ingestion Stalled - Missing Partition",
            error_type="MISSING_PARTITION",
            root_cause="Upstream POS payment gateway webhook failed during 13:00 UTC hourly rollover; partition folder empty.",
            severity="CRITICAL",
            status="OPEN",
            business_impact_summary="Executive daily revenue briefing stale by 90 minutes. 3 downstream reporting assets impacted. High risk of delayed finance sign-off.",
            estimated_sla_breach_mins=90,
            opened_at=now - timedelta(minutes=40),
        )
        db.add(sales_incident)
        db.flush()

        # Proposed Recovery Plan (Requires Human Approval)
        recovery_plan = RecoveryPlan(
            incident_id=sales_incident.id,
            action_type="REPLAY_PARTITION_FROM_RAW_STREAM",
            description="Query raw event lake for transaction range 13:00-14:00 UTC, reconstruct partition, and trigger targeted backfill transform.",
            playbook_steps=(
                "1. Scan raw Kafka/S3 ingestion buffer for timestamp window [13:00 - 14:00 UTC].\n"
                "2. Rehydrate missing Parquet partition in staging bucket.\n"
                "3. Execute targeted transform DAG with --override-lock flag.\n"
                "4. Run automated data verifier on row counts and null values."
            ),
            risk_level="LOW",
            requires_approval=True,
            status="PENDING_APPROVAL",
        )
        db.add(recovery_plan)

        # Initial Audit Trail
        audit_events = [
            AuditLog(
                pipeline_id=sales_pipeline.id,
                incident_id=sales_incident.id,
                action="PIPELINE_FAILED",
                actor="System Monitor",
                details="Hourly ingestion run failed with error: Missing Partition '2026-10-25/hour=13'.",
                timestamp=now - timedelta(minutes=45),
            ),
            AuditLog(
                pipeline_id=sales_pipeline.id,
                incident_id=sales_incident.id,
                action="INCIDENT_CREATED",
                actor="OpsPilot AI",
                details="Incident #1 opened with CRITICAL severity. Downstream blast radius identified: 3 assets affected.",
                timestamp=now - timedelta(minutes=40),
            ),
            AuditLog(
                pipeline_id=sales_pipeline.id,
                incident_id=sales_incident.id,
                action="RECOVERY_PROPOSED",
                actor="OpsPilot AI",
                details="Recovery Plan 'REPLAY_PARTITION_FROM_RAW_STREAM' formulated. Status: PENDING_APPROVAL.",
                timestamp=now - timedelta(minutes=38),
            ),
        ]
        db.add_all(audit_events)

    # -------------------------------------------------------------------------
    # Pipeline 2: Customer Activity Stream (HEALTHY)
    # -------------------------------------------------------------------------
    cust_pipeline = db.query(Pipeline).filter_by(pipeline_key="customer-activity-stream").first()
    if not cust_pipeline:
        cust_pipeline = Pipeline(
            name="Customer Activity Stream",
            pipeline_key="customer-activity-stream",
            description="Real-time ingestion of customer clickstream, mobile app sessions, and feature engagement.",
            status="HEALTHY",
            schedule="Every 15 mins",
            last_run_at=now - timedelta(minutes=8),
            error_message=None,
        )
        db.add(cust_pipeline)
        db.flush()

        db.add_all([
            DownstreamAsset(
                pipeline_id=cust_pipeline.id,
                name="Live Customer Churn Predictor",
                asset_type="ML_MODEL",
                business_unit="Product Analytics",
                criticality="MEDIUM",
                sla_threshold_hours=6,
                description="Scores user attrition risk based on 7-day activity drop-offs.",
            ),
            DownstreamAsset(
                pipeline_id=cust_pipeline.id,
                name="Customer 360 Support Portal",
                asset_type="DATA_API",
                business_unit="Customer Support",
                criticality="HIGH",
                sla_threshold_hours=2,
                description="Provides support agents with real-time customer event timeline.",
            ),
        ])

    # -------------------------------------------------------------------------
    # Pipeline 3: Inventory & Warehouse Sync (HEALTHY)
    # -------------------------------------------------------------------------
    inv_pipeline = db.query(Pipeline).filter_by(pipeline_key="inventory-warehouse-sync").first()
    if not inv_pipeline:
        inv_pipeline = Pipeline(
            name="Inventory & Warehouse Sync",
            pipeline_key="inventory-warehouse-sync",
            description="Synchronizes inventory stock levels across regional fulfillment centers and e-commerce stores.",
            status="HEALTHY",
            schedule="Every 30 mins",
            last_run_at=now - timedelta(minutes=14),
            error_message=None,
        )
        db.add(inv_pipeline)
        db.flush()

        db.add_all([
            DownstreamAsset(
                pipeline_id=inv_pipeline.id,
                name="Warehouse Replenishment Planner",
                asset_type="BI_REPORT",
                business_unit="Supply Chain Logistics",
                criticality="HIGH",
                sla_threshold_hours=12,
                description="Generates daily purchase orders for regional warehouse restocks.",
            ),
            DownstreamAsset(
                pipeline_id=inv_pipeline.id,
                name="Out-of-Stock Realtime Alerting",
                asset_type="ALERTING",
                business_unit="E-Commerce Ops",
                criticality="CRITICAL",
                sla_threshold_hours=1,
                description="Disables purchase buttons on website when warehouse SKU count hits safety zero.",
            ),
        ])

    db.commit()

    total_pipelines = db.query(Pipeline).count()
    return {
        "seeded": True,
        "message": f"Successfully initialized and seeded database with {total_pipelines} demo pipelines.",
        "pipelines_count": total_pipelines,
    }
