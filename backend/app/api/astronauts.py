from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Astronaut, VitalReading, Alert
from app.schemas import AstronautResponse, AstronautCreate, AstronautUpdate

router = APIRouter(prefix="/astronauts", tags=["Astronauts"])

@router.get("", response_model=List[AstronautResponse])
def list_astronauts(db: Session = Depends(get_db)):
    return db.query(Astronaut).filter(Astronaut.active == True).all()

@router.post("", response_model=AstronautResponse, status_code=201)
def create_astronaut(astronaut_in: AstronautCreate, db: Session = Depends(get_db)):
    existing = db.query(Astronaut).filter(Astronaut.id == astronaut_in.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Astronaut with ID '{astronaut_in.id}' already exists.")
    astro = Astronaut(**astronaut_in.model_dump())
    db.add(astro)
    db.commit()
    db.refresh(astro)
    return astro

@router.get("/{astronaut_id}", response_model=AstronautResponse)
def get_astronaut(astronaut_id: str, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut not found.")
    return astro

@router.get("/{astronaut_id}/status")
def get_astronaut_status(astronaut_id: str, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut not found.")

    # Get latest reading for each primary metric
    metrics = ["heart_rate", "spo2", "body_temp", "resp_rate", "systolic_bp"]
    latest_readings = {}
    for m in metrics:
        reading = db.query(VitalReading).filter(
            VitalReading.astronaut_id == astronaut_id,
            VitalReading.metric == m
        ).order_by(VitalReading.measured_at.desc()).first()
        if reading:
            latest_readings[m] = {
                "value": reading.value,
                "unit": reading.unit,
                "measured_at": reading.measured_at.isoformat()
            }

    # Count active alerts
    active_alerts = db.query(Alert).filter(
        Alert.astronaut_id == astronaut_id,
        Alert.status == "ACTIVE"
    ).all()

    has_critical = any(a.severity == "CRITICAL" for a in active_alerts)
    has_warning = any(a.severity == "WARNING" for a in active_alerts)

    if has_critical:
        overall_status = "CRITICAL"
    elif has_warning:
        overall_status = "ADVISORY"
    else:
        overall_status = "NOMINAL"

    return {
        "astronaut_id": astro.id,
        "display_name": astro.display_name,
        "role": astro.role,
        "overall_status": overall_status,
        "active_alerts_count": len(active_alerts),
        "latest_metrics": latest_readings
    }

