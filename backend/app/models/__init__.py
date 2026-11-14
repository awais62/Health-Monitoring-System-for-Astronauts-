from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Astronaut(Base):
    __tablename__ = "astronauts"

    id = Column(String(50), primary_key=True, index=True)
    display_name = Column(String(100), nullable=False)
    mission_code = Column(String(50), nullable=False, default="ARTEMIS-III")
    role = Column(String(50), nullable=False, default="Commander")
    profile_notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    readings = relationship("VitalReading", back_populates="astronaut", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="astronaut", cascade="all, delete-orphan")
    model_results = relationship("ModelResult", back_populates="astronaut", cascade="all, delete-orphan")


class VitalReading(Base):
    __tablename__ = "vital_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    astronaut_id = Column(String(50), ForeignKey("astronauts.id"), index=True, nullable=False)
    metric = Column(String(50), index=True, nullable=False)  # heart_rate, spo2, body_temp, resp_rate, systolic_bp, diastolic_bp
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    measured_at = Column(DateTime, nullable=False, index=True)
    source = Column(String(50), default="TELEMETRY_STREAM")
    received_at = Column(DateTime, default=utcnow)

    astronaut = relationship("Astronaut", back_populates="readings")


class ThresholdConfig(Base):
    __tablename__ = "threshold_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    metric = Column(String(50), unique=True, index=True, nullable=False)
    warning_low = Column(Float, nullable=True)
    warning_high = Column(Float, nullable=True)
    critical_low = Column(Float, nullable=True)
    critical_high = Column(Float, nullable=True)
    unit = Column(String(20), nullable=False)
    enabled = Column(Boolean, default=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    astronaut_id = Column(String(50), ForeignKey("astronauts.id"), index=True, nullable=False)
    reading_id = Column(Integer, ForeignKey("vital_readings.id"), nullable=True)
    metric = Column(String(50), nullable=False)
    value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=True)
    severity = Column(String(20), nullable=False)  # WARNING, CRITICAL
    message = Column(String(255), nullable=False)
    status = Column(String(20), default="ACTIVE")  # ACTIVE, ACKNOWLEDGED, RESOLVED
    created_at = Column(DateTime, default=utcnow, index=True)

    astronaut = relationship("Astronaut", back_populates="alerts")
    actions = relationship("AlertAction", back_populates="alert", cascade="all, delete-orphan")


class AlertAction(Base):
    __tablename__ = "alert_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    user_id = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)  # ACKNOWLEDGED, SNOOZED, RESOLVED
    action_at = Column(DateTime, default=utcnow)
    note = Column(Text, nullable=True)

    alert = relationship("Alert", back_populates="actions")


class ModelResult(Base):
    __tablename__ = "model_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    astronaut_id = Column(String(50), ForeignKey("astronauts.id"), index=True, nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    model_version = Column(String(50), default="isoforest_v1.0")
    score = Column(Float, nullable=False)
    flag = Column(Boolean, default=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    astronaut = relationship("Astronaut", back_populates="model_results")


class SyncQueue(Base):
    __tablename__ = "sync_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_type = Column(String(50), nullable=False)  # VITAL_READING, ALERT_ACTION, AUDIT
    payload_json = Column(Text, nullable=False)
    sync_status = Column(String(20), default="PENDING")  # PENDING, SYNCED, FAILED
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    synced_at = Column(DateTime, nullable=True)

