from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pipeline
from app.schemas import PipelineResponse, ImpactReportResponse
from app.services.impact_analyzer import calculate_pipeline_impact

router = APIRouter(prefix="/api/pipelines", tags=["Pipelines"])


@router.get("", response_model=List[PipelineResponse])
def get_all_pipelines(db: Session = Depends(get_db)):
    """
    List all data pipelines with their current operational status,
    downstream asset counts, and active incidents.
    """
    pipelines = db.query(Pipeline).order_by(Pipeline.id).all()
    return pipelines


@router.get("/{pipeline_id}", response_model=PipelineResponse)
def get_pipeline_by_id(pipeline_id: int, db: Session = Depends(get_db)):
    """
    Fetch comprehensive details for a specific data pipeline.
    """
    pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline with ID {pipeline_id} not found.",
        )
    return pipeline


@router.get("/{pipeline_id}/impact", response_model=ImpactReportResponse)
def get_pipeline_impact(pipeline_id: int, db: Session = Depends(get_db)):
    """
    Calculate and return the dynamic downstream business blast radius
    and impact report for a specific pipeline based on database relationships.
    """
    pipeline = db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline with ID {pipeline_id} not found.",
        )

    impact_data = calculate_pipeline_impact(pipeline)
    return impact_data
