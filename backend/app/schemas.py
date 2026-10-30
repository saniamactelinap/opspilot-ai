from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# -------------------------------------------------------------
# Downstream Asset Schemas
# -------------------------------------------------------------
class DownstreamAssetBase(BaseModel):
    name: str
    asset_type: str
    business_unit: str
    criticality: str
    sla_threshold_hours: int = 2
    description: Optional[str] = None


class DownstreamAssetResponse(DownstreamAssetBase):
    id: int
    pipeline_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Recovery Plan Schemas
# -------------------------------------------------------------
class RecoveryPlanBase(BaseModel):
    action_type: str
    description: str
    playbook_steps: Optional[str] = None
    risk_level: str = "LOW"
    requires_approval: bool = True


class RecoveryPlanResponse(RecoveryPlanBase):
    id: int
    incident_id: int
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovePlanRequest(BaseModel):
    approved_by: Optional[str] = Field(
        default="Operations Engineer",
        description="Name or role of the engineer approving this recovery operation",
    )


class RejectPlanRequest(BaseModel):
    rejected_by: Optional[str] = Field(
        default="Operations Engineer",
        description="Name or role of the engineer rejecting this recovery plan",
    )
    reason: Optional[str] = Field(
        default="Manual investigation required; automated playbook rejected.",
        description="Explanation for rejecting the plan",
    )


class RecoverRequest(BaseModel):
    simulate_verification_failure: bool = Field(
        default=False,
        description="Set to true to demonstrate a controlled verification failure scenario",
    )
    recovered_by: Optional[str] = Field(
        default="OpsPilot Orchestrator",
        description="Actor executing the recovery workflow",
    )


# -------------------------------------------------------------
# Verification Schemas
# -------------------------------------------------------------
class VerificationCheckResult(BaseModel):
    check_name: str
    passed: bool
    details: str


class VerificationReport(BaseModel):
    all_passed: bool
    checks: List[VerificationCheckResult]
    summary: str


class RecoveryExecutionResponse(BaseModel):
    message: str
    incident_id: int
    pipeline_id: int
    incident_status: str
    pipeline_status: str
    plan_status: str
    verification_report: VerificationReport


# -------------------------------------------------------------
# Incident Schemas
# -------------------------------------------------------------
class IncidentBase(BaseModel):
    title: str
    error_type: str
    root_cause: str
    severity: str
    status: str = "OPEN"
    business_impact_summary: Optional[str] = None
    estimated_sla_breach_mins: int = 0


class IncidentResponse(IncidentBase):
    id: int
    pipeline_id: int
    opened_at: datetime
    resolved_at: Optional[datetime] = None
    recovery_plans: List[RecoveryPlanResponse] = []

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Pipeline Schemas
# -------------------------------------------------------------
class PipelineBase(BaseModel):
    name: str
    pipeline_key: str
    description: Optional[str] = None
    status: str
    schedule: str
    error_message: Optional[str] = None


class PipelineResponse(PipelineBase):
    id: int
    last_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    downstream_assets: List[DownstreamAssetResponse] = []
    incidents: List[IncidentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Impact Analysis Schemas
# -------------------------------------------------------------
class DemoRiskEstimate(BaseModel):
    is_illustrative: bool = True
    disclaimer: str
    estimated_sla_breach_mins: int
    illustrative_financial_risk_usd: int
    calculation_basis: str


class ImpactReportResponse(BaseModel):
    pipeline_id: int
    pipeline_name: str
    pipeline_key: str
    current_status: str
    schedule: str
    error_message: Optional[str] = None
    affected_assets_count: int
    affected_assets: List[DownstreamAssetResponse]
    affected_business_teams: List[str]
    criticality_breakdown: Dict[str, int]
    severity_classification: str
    severity_rationale: str
    demo_risk_estimate: DemoRiskEstimate


# -------------------------------------------------------------
# Simulation Schemas
# -------------------------------------------------------------
class SimulateFailureRequest(BaseModel):
    pipeline_id: int = Field(..., description="ID of the pipeline to simulate failure on")
    failure_type: str = Field(
        ...,
        description="Type of failure: MISSING_PARTITION, SCHEMA_MISMATCH, or API_TIMEOUT",
    )


class SimulateFailureResponse(BaseModel):
    message: str
    pipeline: PipelineResponse
    incident: IncidentResponse
    impact_report: ImpactReportResponse


# -------------------------------------------------------------
# Audit Log Schemas
# -------------------------------------------------------------
class AuditLogResponse(BaseModel):
    id: int
    incident_id: Optional[int] = None
    pipeline_id: Optional[int] = None
    action: str
    actor: str
    details: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Health Check Schema
# -------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    database: str
    pipelines_count: int
