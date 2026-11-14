from typing import Optional, Tuple
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import ThresholdConfig, Alert, VitalReading

DEFAULT_THRESHOLDS = [
    {
        "metric": "heart_rate",
        "unit": "bpm",
        "warning_low": 50.0,
        "warning_high": 100.0,
        "critical_low": 40.0,
        "critical_high": 130.0,
    },
    {
        "metric": "spo2",
        "unit": "%",
        "warning_low": 94.0,
        "warning_high": None,
        "critical_low": 90.0,
        "critical_high": None,
    },
    {
        "metric": "body_temp",
        "unit": "°C",
        "warning_low": 36.0,
        "warning_high": 37.8,
        "critical_low": 35.0,
        "critical_high": 39.0,
    },
    {
        "metric": "resp_rate",
        "unit": "brpm",
        "warning_low": 10.0,
        "warning_high": 22.0,
        "critical_low": 8.0,
        "critical_high": 30.0,
    },
    {
        "metric": "systolic_bp",
        "unit": "mmHg",
        "warning_low": 90.0,
        "warning_high": 135.0,
        "critical_low": 80.0,
        "critical_high": 160.0,
    },
]

def init_default_thresholds(db: Session):
    """Seed initial aerospace medical threshold limits if not present."""
    for config in DEFAULT_THRESHOLDS:
        existing = db.query(ThresholdConfig).filter(ThresholdConfig.metric == config["metric"]).first()
        if not existing:
            threshold = ThresholdConfig(
                metric=config["metric"],
                unit=config["unit"],
                warning_low=config["warning_low"],
                warning_high=config["warning_high"],
                critical_low=config["critical_low"],
                critical_high=config["critical_high"],
                enabled=True,
            )
            db.add(threshold)
    db.commit()


def evaluate_reading(db: Session, reading: VitalReading) -> Optional[Alert]:
    """
    Deterministic rule-based physiological check.
    Evaluates reading against configurable limits, enforces deduplication to prevent alert storms.
    """
    config = db.query(ThresholdConfig).filter(
        ThresholdConfig.metric == reading.metric,
        ThresholdConfig.enabled == True
    ).first()

    if not config:
        return None

    val = reading.value
    severity: Optional[str] = None
    threshold_val: Optional[float] = None
    message = ""

    # Check Critical limits first
    if config.critical_high is not None and val >= config.critical_high:
        severity = "CRITICAL"
        threshold_val = config.critical_high
        message = f"CRITICAL HIGH: {reading.metric} is {val:.1f} {reading.unit} (Limit: >= {config.critical_high} {reading.unit})"
    elif config.critical_low is not None and val <= config.critical_low:
        severity = "CRITICAL"
        threshold_val = config.critical_low
        message = f"CRITICAL LOW: {reading.metric} is {val:.1f} {reading.unit} (Limit: <= {config.critical_low} {reading.unit})"
    # Check Warning limits next
    elif config.warning_high is not None and val >= config.warning_high:
        severity = "WARNING"
        threshold_val = config.warning_high
        message = f"WARNING HIGH: {reading.metric} is {val:.1f} {reading.unit} (Limit: >= {config.warning_high} {reading.unit})"
    elif config.warning_low is not None and val <= config.warning_low:
        severity = "WARNING"
        threshold_val = config.warning_low
        message = f"WARNING LOW: {reading.metric} is {val:.1f} {reading.unit} (Limit: <= {config.warning_low} {reading.unit})"

    if not severity:
        return None

    # Alert Deduplication: Check if an ACTIVE alert for this astronaut and metric was triggered within last 30s
    debounce_time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=30)
    existing_alert = db.query(Alert).filter(
        Alert.astronaut_id == reading.astronaut_id,
        Alert.metric == reading.metric,
        Alert.status == "ACTIVE",
        Alert.created_at >= debounce_time
    ).first()

    if existing_alert:
        # Avoid flood; already active
        return None

    alert = Alert(
        astronaut_id=reading.astronaut_id,
        reading_id=reading.id,
        metric=reading.metric,
        value=val,
        threshold=threshold_val,
        severity=severity,
        message=message,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
