from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.database import get_db
from app.models import Astronaut, VitalReading, Alert, ModelResult
from app.schemas import HealthSummaryResponse, TelemetrySummary

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/astronauts/{astronaut_id}", response_model=HealthSummaryResponse)
def get_astronaut_health_summary(
    astronaut_id: str,
    hours: int = Query(default=24, ge=1, le=168),
    db: Session = Depends(get_db)
):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut not found.")

    end_time = datetime.now(timezone.utc).replace(tzinfo=None)
    start_time = end_time - timedelta(hours=hours)

    metrics = [
        ("heart_rate", "bpm"),
        ("spo2", "%"),
        ("body_temp", "°C"),
        ("resp_rate", "brpm"),
        ("systolic_bp", "mmHg")
    ]

    metric_summaries = []
    for m, unit in metrics:
        readings = db.query(VitalReading).filter(
            VitalReading.astronaut_id == astronaut_id,
            VitalReading.metric == m,
            VitalReading.measured_at >= start_time
        ).all()

        if readings:
            vals = [r.value for r in readings]
            latest = readings[-1].value
            metric_summaries.append(TelemetrySummary(
                metric=m,
                current=round(latest, 1),
                min=round(min(vals), 1),
                max=round(max(vals), 1),
                avg=round(sum(vals) / len(vals), 1),
                unit=unit
            ))
        else:
            metric_summaries.append(TelemetrySummary(
                metric=m,
                current=None,
                min=None,
                max=None,
                avg=None,
                unit=unit
            ))

    alerts = db.query(Alert).filter(
        Alert.astronaut_id == astronaut_id,
        Alert.created_at >= start_time
    ).all()

    total_alerts = len(alerts)
    active_alerts = sum(1 for a in alerts if a.status == "ACTIVE")
    ack_alerts = sum(1 for a in alerts if a.status == "ACKNOWLEDGED")

    # Count ML anomalies
    anomalies = db.query(ModelResult).filter(
        ModelResult.astronaut_id == astronaut_id,
        ModelResult.flag == True,
        ModelResult.created_at >= start_time
    ).count()

    # Determine overall physiological status
    has_critical = any(a.severity == "CRITICAL" for a in alerts if a.status == "ACTIVE")
    has_warning = any(a.severity == "WARNING" for a in alerts if a.status == "ACTIVE")

    if has_critical:
        overall_status = "CRITICAL"
    elif has_warning or anomalies > 0:
        overall_status = "ADVISORY"
    else:
        overall_status = "NOMINAL"

    return HealthSummaryResponse(
        astronaut_id=astro.id,
        display_name=astro.display_name,
        mission_code=astro.mission_code,
        period_start=start_time,
        period_end=end_time,
        metrics_summary=metric_summaries,
        total_alerts=total_alerts,
        active_alerts=active_alerts,
        acknowledged_alerts=ack_alerts,
        anomalies_detected=anomalies,
        overall_status=overall_status
    )

