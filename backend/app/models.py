from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Pipeline(Base):
    """
    Represents an operational data pipeline in the organization.
    """
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    pipeline_key = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="HEALTHY")  # HEALTHY, FAILED, DEGRADED, RECOVERING
    schedule = Column(String(50), default="Hourly")
    last_run_at = Column(DateTime, default=datetime.utcnow)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    downstream_assets = relationship(
        "DownstreamAsset",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="DownstreamAsset.id",
    )
    incidents = relationship(
        "Incident",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="Incident.id.desc()",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="pipeline",
        order_by="AuditLog.timestamp.desc()",
    )


class DownstreamAsset(Base):
    """
    Represents a downstream report, dashboard, ML model, or business system
    that relies on data from a parent pipeline.
    """
    __tablename__ = "downstream_assets"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    asset_type = Column(String(50), nullable=False)  # BI_REPORT, DASHBOARD, ML_MODEL, AUDIT_SYSTEM, ALERTING
    business_unit = Column(String(100), nullable=False)  # Executive Leadership, Finance, Supply Chain, etc.
    criticality = Column(String(50), nullable=False, default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    sla_threshold_hours = Column(Integer, default=2)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to parent pipeline
    pipeline = relationship("Pipeline", back_populates="downstream_assets")


class Incident(Base):
    """
    Represents an operational incident triggered when a pipeline fails or degrades.
    """
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    error_type = Column(String(100), nullable=False)  # MISSING_PARTITION, SCHEMA_DRIFT, TIMEOUT, etc.
    root_cause = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False, default="HIGH")  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(50), nullable=False, default="OPEN")  # OPEN, PENDING_APPROVAL, IN_RECOVERY, VERIFYING, RESOLVED
    business_impact_summary = Column(Text, nullable=True)
    estimated_sla_breach_mins = Column(Integer, default=0)
    opened_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    pipeline = relationship("Pipeline", back_populates="incidents")
    recovery_plans = relationship(
        "RecoveryPlan",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="RecoveryPlan.id.desc()",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="AuditLog.timestamp.desc()",
    )


class RecoveryPlan(Base):
    """
    Represents an intelligent recovery playbook proposed by OpsPilot AI.
    Requires human approval before execution.
    """
    __tablename__ = "recovery_plans"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    action_type = Column(String(100), nullable=False)  # REPLAY_PARTITION, ROLLBACK_SCHEMA, CLEAR_LOCK_AND_RERUN
    description = Column(Text, nullable=False)
    playbook_steps = Column(Text, nullable=True)
    risk_level = Column(String(50), default="LOW")  # LOW, MEDIUM, HIGH
    requires_approval = Column(Boolean, default=True)
    status = Column(String(50), default="PENDING_APPROVAL")  # PENDING_APPROVAL, APPROVED, REJECTED, EXECUTED
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to parent incident
    incident = relationship("Incident", back_populates="recovery_plans")


class AuditLog(Base):
    """
    Immutable audit trail recording every failure detection, AI proposal,
    human approval, simulated recovery execution, and verification result.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    actor = Column(String(100), nullable=False)  # OpsPilot AI, Operations Engineer, System Monitor
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    incident = relationship("Incident", back_populates="audit_logs")
    pipeline = relationship("Pipeline", back_populates="audit_logs")
