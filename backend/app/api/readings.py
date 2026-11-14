from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import io
import csv
from pydantic import BaseModel
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

class HardwareSensorPacket(BaseModel):
    """
    Standard IoT / Wearable Sensor Ingestion schema for real-world devices.
    Used by Bluetooth BLE hubs, smart garments, or pulse oximeters.
    """
    astronaut_id: str
    device_id: str
    heart_rate: Optional[float] = None
    spo2: Optional[float] = None
    body_temp: Optional[float] = None
    resp_rate: Optional[float] = None
    systolic_bp: Optional[float] = None
    timestamp: Optional[datetime] = None

@router.post("", response_model=VitalReadingResponse, status_code=201)
def submit_reading(reading_in: VitalReadingCreate, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == reading_in.astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail=f"Astronaut '{reading_in.astronaut_id}' does not exist.")

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

    evaluate_reading(db, reading)

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

@router.post("/hardware-packet")
def ingest_hardware_packet(packet: HardwareSensorPacket, db: Session = Depends(get_db)):
    """
    Real-world IoT Wearable adapter:
    Converts multi-sensor telemetry packets (e.g. from Hexoskin, Polar, or BioHarness)
    into validated individual readings and triggers real-time safety evaluation.
    """
    astro = db.query(Astronaut).filter(Astronaut.id == packet.astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail=f"Astronaut '{packet.astronaut_id}' not found.")

    now = packet.timestamp or datetime.now(timezone.utc).replace(tzinfo=None)
    inserted_readings = []

    metrics_map = [
        ("heart_rate", packet.heart_rate, "bpm"),
        ("spo2", packet.spo2, "%"),
        ("body_temp", packet.body_temp, "°C"),
        ("resp_rate", packet.resp_rate, "brpm"),
        ("systolic_bp", packet.systolic_bp, "mmHg"),
    ]

    for metric_name, val, unit in metrics_map:
        if val is not None:
            r = VitalReading(
                astronaut_id=packet.astronaut_id,
                metric=metric_name,
                value=float(val),
                unit=unit,
                measured_at=now,
                source=f"HARDWARE_{packet.device_id}",
                received_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(r)
            db.commit()
            db.refresh(r)
            evaluate_reading(db, r)
            inserted_readings.append({"metric": metric_name, "value": val, "unit": unit})

    return {
        "status": "SUCCESS",
        "astronaut_id": packet.astronaut_id,
        "device_id": packet.device_id,
        "readings_ingested": len(inserted_readings),
        "readings": inserted_readings
    }

@router.post("/upload-csv")
async def upload_real_world_csv(
    astronaut_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Ingest real-world medical datasets (e.g. PhysioNet, smartwatch exports) from CSV.
    Expected CSV columns: heart_rate, spo2, body_temp, resp_rate, systolic_bp (optional timestamp).
    """
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

    content = await file.read()
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    ingested_count = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for row in reader:
        # Standardize column headers
        row_clean = {k.strip().lower(): v.strip() for k, v in row.items() if k and v}
        
        for metric, unit in [
            ("heart_rate", "bpm"),
            ("spo2", "%"),
            ("body_temp", "°C"),
            ("resp_rate", "brpm"),
            ("systolic_bp", "mmHg")
        ]:
            if metric in row_clean and row_clean[metric]:
                try:
                    val = float(row_clean[metric])
                    r = VitalReading(
                        astronaut_id=astronaut_id,
                        metric=metric,
                        value=val,
                        unit=unit,
                        measured_at=now,
                        source=f"CSV_INGEST_{file.filename}",
                        received_at=now
                    )
                    db.add(r)
                    db.commit()
                    db.refresh(r)
                    evaluate_reading(db, r)
                    ingested_count += 1
                except ValueError:
                    continue

    return {
        "status": "SUCCESS",
        "astronaut_id": astronaut_id,
        "filename": file.filename,
        "total_data_points_ingested": ingested_count
    }

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
