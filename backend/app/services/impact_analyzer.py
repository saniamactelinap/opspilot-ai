from typing import Dict, Any, List
from app.models import Pipeline, DownstreamAsset


def calculate_pipeline_impact(pipeline: Pipeline) -> Dict[str, Any]:
    """
    Dynamically computes the business blast radius and downstream impact
    for a given pipeline based on real database records and relationships.

    Returns:
    - Failed pipeline details
    - Affected downstream assets
    - Count of affected assets
    - Affected business teams
    - Criticality breakdown
    - Severity classification (CRITICAL, HIGH, MEDIUM)
    - Transparent severity assignment rationale
    - Illustrative demo risk estimates (clearly disclaimed)
    """
    assets: List[DownstreamAsset] = pipeline.downstream_assets or []
    asset_count = len(assets)

    # Extract distinct affected business teams
    affected_teams = sorted(list({a.business_unit for a in assets}))

    # Criticality breakdown counts
    critical_count = sum(1 for a in assets if a.criticality == "CRITICAL")
    high_count = sum(1 for a in assets if a.criticality == "HIGH")
    medium_count = sum(1 for a in assets if a.criticality == "MEDIUM")
    low_count = sum(1 for a in assets if a.criticality == "LOW")

    criticality_breakdown = {
        "CRITICAL": critical_count,
        "HIGH": high_count,
        "MEDIUM": medium_count,
        "LOW": low_count,
    }

    # Minimum SLA across downstream assets
    min_sla = min([a.sla_threshold_hours for a in assets], default=24)

    # -------------------------------------------------------------------------
    # Severity Classification Rules
    # -------------------------------------------------------------------------
    if critical_count > 0 or min_sla <= 1 or asset_count >= 3:
        severity = "CRITICAL"
        reasons = []
        if critical_count > 0:
            critical_names = [a.name for a in assets if a.criticality == "CRITICAL"]
            reasons.append(f"{critical_count} mission-critical asset(s) impacted ({', '.join(critical_names)})")
        if min_sla <= 1:
            reasons.append(f"strict SLA threshold of <= {min_sla} hour(s)")
        if asset_count >= 3:
            reasons.append(f"broad blast radius impacting {asset_count} downstream assets across {len(affected_teams)} teams")

        rationale = (
            f"Classified as CRITICAL severity due to: {'; '.join(reasons)}. "
            "Immediate operational triage required to prevent leadership reporting interruption and regulatory SLA breach."
        )

    elif high_count > 0 or asset_count >= 1:
        severity = "HIGH"
        high_names = [a.name for a in assets if a.criticality == "HIGH"]
        rationale = (
            f"Classified as HIGH severity: {asset_count} asset(s) impacted across teams ({', '.join(affected_teams)}). "
            f"Includes {high_count} high-priority asset(s): {', '.join(high_names)}. "
            f"SLA breach anticipated within {min_sla} hours if not resolved."
        )

    else:
        severity = "MEDIUM"
        rationale = (
            f"Classified as MEDIUM severity: {asset_count} low-criticality asset(s) impacted. "
            f"SLA threshold of {min_sla} hours allows standard queue recovery without urgent escalation."
        )

    # -------------------------------------------------------------------------
    # Illustrative Demo Risk Estimate (Explicitly Disclaimed)
    # -------------------------------------------------------------------------
    # Illustrative weight formula: $25k for each critical asset, $10k for high, $2.5k for medium
    illustrative_loss = (critical_count * 25000) + (high_count * 10000) + (medium_count * 2500)
    estimated_sla_mins = 90 if severity == "CRITICAL" else (45 if severity == "HIGH" else 15)
    if asset_count == 0:
        estimated_sla_mins = 0
        illustrative_loss = 0

    demo_risk_estimate = {
        "is_illustrative": True,
        "disclaimer": (
            "ILLUSTRATIVE DEMO ESTIMATE ONLY: Calculated for hackathon operational risk modeling "
            "based on asset criticality weights ($25,000/critical, $10,000/high, $2,500/medium). "
            "Does NOT represent realized financial loss."
        ),
        "estimated_sla_breach_mins": estimated_sla_mins,
        "illustrative_financial_risk_usd": illustrative_loss,
        "calculation_basis": (
            f"Formula: ($25,000 x {critical_count} critical) + ($10,000 x {high_count} high) + "
            f"($2,500 x {medium_count} medium) = ${illustrative_loss:,} USD illustrative impact."
        ),
    }

    return {
        "pipeline_id": pipeline.id,
        "pipeline_name": pipeline.name,
        "pipeline_key": pipeline.pipeline_key,
        "current_status": pipeline.status,
        "schedule": pipeline.schedule,
        "error_message": pipeline.error_message,
        "affected_assets_count": asset_count,
        "affected_assets": assets,
        "affected_business_teams": affected_teams,
        "criticality_breakdown": criticality_breakdown,
        "severity_classification": severity,
        "severity_rationale": rationale,
        "demo_risk_estimate": demo_risk_estimate,
    }
