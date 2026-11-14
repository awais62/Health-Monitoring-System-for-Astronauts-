from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models import Alert, AlertAction, ThresholdConfig
from app.schemas import AlertResponse, AlertAcknowledgeRequest, ThresholdConfigSchema
from app.services.sync_service import sync_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    astronaut_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if astronaut_id:
        query = query.filter(Alert.astronaut_id == astronaut_id)
    if status:
        query = query.filter(Alert.status == status.upper())
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    return query.order_by(Alert.created_at.desc()).limit(limit).all()

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    ack: AlertAcknowledgeRequest,
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    alert.status = "ACKNOWLEDGED"

    action = AlertAction(
        alert_id=alert.id,
        user_id=ack.user_id,
        action="ACKNOWLEDGED",
        action_at=datetime.now(timezone.utc).replace(tzinfo=None),
        note=ack.note
    )
    db.add(action)
    db.commit()
    db.refresh(alert)

    # If offline, enqueue action for later Earth MCC audit synchronization
    if not sync_service.is_connected_to_earth:
        sync_service.enqueue_record(db, "ALERT_ACTION", {
            "alert_id": alert.id,
            "user_id": ack.user_id,
            "action": "ACKNOWLEDGED",
            "action_at": action.action_at.isoformat(),
            "note": ack.note
        })

    return alert

@router.get("/thresholds", response_model=List[ThresholdConfigSchema])
def get_thresholds(db: Session = Depends(get_db)):
    return db.query(ThresholdConfig).all()

@router.put("/thresholds/{metric}", response_model=ThresholdConfigSchema)
def update_threshold(metric: str, update_in: ThresholdConfigSchema, db: Session = Depends(get_db)):
    config = db.query(ThresholdConfig).filter(ThresholdConfig.metric == metric.lower()).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"Threshold for metric '{metric}' not found.")

    config.warning_low = update_in.warning_low
    config.warning_high = update_in.warning_high
    config.critical_low = update_in.critical_low
    config.critical_high = update_in.critical_high
    config.enabled = update_in.enabled
    db.commit()
    db.refresh(config)
    return config
