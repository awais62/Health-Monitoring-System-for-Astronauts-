from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class AstronautBase(BaseModel):
    id: str = Field(..., description="Unique alphanumeric identifier (e.g. AST-01)")
    display_name: str = Field(..., min_length=2, max_length=100)
    mission_code: str = Field(default="ARTEMIS-III")
    role: str = Field(default="Commander")
    profile_notes: Optional[str] = None
    active: bool = True

class AstronautCreate(AstronautBase):
    pass

class AstronautUpdate(BaseModel):
    display_name: Optional[str] = None
    mission_code: Optional[str] = None
    role: Optional[str] = None
    profile_notes: Optional[str] = None
    active: Optional[bool] = None

class AstronautResponse(AstronautBase):
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VitalReadingCreate(BaseModel):
    astronaut_id: str
    metric: str
    value: float
    unit: str
    measured_at: Optional[datetime] = None
    source: str = "TELEMETRY_STREAM"

class VitalReadingResponse(BaseModel):
    id: int
    astronaut_id: str
    metric: str
    value: float
    unit: str
    measured_at: datetime
    source: str
    received_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BatchVitalReadingCreate(BaseModel):
    readings: List[VitalReadingCreate]


class ThresholdConfigSchema(BaseModel):
    metric: str
    warning_low: Optional[float] = None
    warning_high: Optional[float] = None
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    unit: str
    enabled: bool = True
    model_config = ConfigDict(from_attributes=True)


class AlertResponse(BaseModel):
    id: int
    astronaut_id: str
    reading_id: Optional[int]
    metric: str
    value: float
    threshold: Optional[float]
    severity: str
    message: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AlertAcknowledgeRequest(BaseModel):
    user_id: str = Field(default="FlightSurgeon-1")
    note: Optional[str] = Field(default="Acknowledged during flight shift")


class ModelAnalysisRequest(BaseModel):
    astronaut_id: str
    window_minutes: int = Field(default=15, ge=1, le=120)

class ModelAnalysisResponse(BaseModel):
    astronaut_id: str
    window_start: datetime
    window_end: datetime
    model_version: str
    score: float
    flag: bool
    is_experimental: bool = True
    explanation: str
    metrics_analyzed: List[str]


class TelemetrySummary(BaseModel):
    metric: str
    current: Optional[float]
    min: Optional[float]
    max: Optional[float]
    avg: Optional[float]
    unit: str

class HealthSummaryResponse(BaseModel):
    astronaut_id: str
    display_name: str
    mission_code: str
    period_start: datetime
    period_end: datetime
    metrics_summary: List[TelemetrySummary]
    total_alerts: int
    active_alerts: int
    acknowledged_alerts: int
    anomalies_detected: int
    overall_status: str  # NOMINAL, ADVISORY, CRITICAL
