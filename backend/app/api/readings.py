from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models import VitalReading, Astronaut
from app.schemas import VitalReadingCreate, VitalReadingResponse
from app.services.rules_engine import evaluate_reading
from app.services.sync_service import sync_service

router = APIRouter(prefix="/readings", tags=["Readings"])

VALID_UNITS = {
    "heart_rate": ["bpm"],
    "spo2": ["%"],
    "body_temp": ["°C", "C"],
    "resp_rate": ["brpm"],
    "systolic_bp": ["mmHg"],
    "diastolic_bp": ["mmHg"]
}

@router.post("", response_model=VitalReadingResponse, status_code=201)
def submit_reading(reading_in: VitalReadingCreate, db: Session = Depends(get_db)):
    # Validate astronaut exists
    astro = db.query(Astronaut).filter(Astronaut.id == reading_in.astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail=f"Astronaut '{reading_in.astronaut_id}' does not exist.")

    # Validate unit
    metric = reading_in.metric.lower()
    if metric in VALID_UNITS and reading_in.unit not in VALID_UNITS[metric]:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid unit '{reading_in.unit}' for metric '{metric}'. Allowed: {VALID_UNITS[metric]}"
        )

    measured_at = reading_in.measured_at or datetime.now(timezone.utc).replace(tzinfo=None)

    reading = VitalReading(
        astronaut_id=reading_in.astronaut_id,
        metric=metric,
        value=reading_in.value,
        unit=reading_in.unit,
        measured_at=measured_at,
        source=reading_in.source,
        received_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # Evaluate safety rules
    evaluate_reading(db, reading)

    # If offline, enqueue into Store-and-Forward sync queue
    if not sync_service.is_connected_to_earth:
        sync_service.enqueue_record(db, "VITAL_READING", {
            "id": reading.id,
            "astronaut_id": reading.astronaut_id,
            "metric": reading.metric,
            "value": reading.value,
            "unit": reading.unit,
            "measured_at": reading.measured_at.isoformat()
        })

    return reading

@router.get("/{astronaut_id}", response_model=List[VitalReadingResponse])
def get_readings_history(
    astronaut_id: str,
    metric: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(VitalReading).filter(VitalReading.astronaut_id == astronaut_id)
    if metric:
        query = query.filter(VitalReading.metric == metric.lower())
    return query.order_by(VitalReading.measured_at.desc()).limit(limit).all()
