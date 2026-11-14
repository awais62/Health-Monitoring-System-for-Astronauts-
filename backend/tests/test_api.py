import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timezone

from app.main import app
from app.database import Base, get_db
from app.models import Astronaut, ThresholdConfig, Alert
from app.services.rules_engine import init_default_thresholds

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    init_default_thresholds(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def test_health_check(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"

def test_create_and_list_astronauts(client):
    astro_data = {
        "id": "AST-TEST",
        "display_name": "Test Astronaut",
        "mission_code": "ARTEMIS-TEST",
        "role": "Mission Specialist",
        "profile_notes": "Test profile"
    }
    create_res = client.post("/api/v1/astronauts", json=astro_data)
    assert create_res.status_code == 201
    assert create_res.json()["id"] == "AST-TEST"

    list_res = client.get("/api/v1/astronauts")
    assert list_res.status_code == 200
    ids = [a["id"] for a in list_res.json()]
    assert "AST-TEST" in ids

def test_vital_reading_ingestion_and_rules_alert(client):
    # Register astronaut
    client.post("/api/v1/astronauts", json={
        "id": "AST-ALERT",
        "display_name": "Alert Subject",
        "mission_code": "ARTEMIS-III",
        "role": "Commander"
    })

    # Nominal reading: no alert
    res_nom = client.post("/api/v1/readings", json={
        "astronaut_id": "AST-ALERT",
        "metric": "heart_rate",
        "value": 72.0,
        "unit": "bpm"
    })
    assert res_nom.status_code == 201

    alerts_res = client.get("/api/v1/alerts?astronaut_id=AST-ALERT")
    assert len(alerts_res.json()) == 0

    # Critical reading: SpO2 critical drop (88.0%)
    res_crit = client.post("/api/v1/readings", json={
        "astronaut_id": "AST-ALERT",
        "metric": "spo2",
        "value": 88.0,
        "unit": "%"
    })
    assert res_crit.status_code == 201

    alerts_res = client.get("/api/v1/alerts?astronaut_id=AST-ALERT")
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    assert alerts[0]["severity"] == "CRITICAL"
    assert alerts[0]["metric"] == "spo2"

def test_alert_acknowledgement(client):
    # Setup
    client.post("/api/v1/astronauts", json={
        "id": "AST-ACK",
        "display_name": "Ack Subject",
        "mission_code": "ARTEMIS-III",
        "role": "Engineer"
    })
    client.post("/api/v1/readings", json={
        "astronaut_id": "AST-ACK",
        "metric": "heart_rate",
        "value": 145.0,
        "unit": "bpm"
    })
    alerts = client.get("/api/v1/alerts?astronaut_id=AST-ACK").json()
    assert len(alerts) > 0
    alert_id = alerts[0]["id"]
    assert alerts[0]["status"] == "ACTIVE"

    ack_res = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", json={
        "user_id": "FlightSurgeon-Test",
        "note": "Verified sinus tachycardia under manual review"
    })
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

def test_ml_anomaly_detection_endpoint(client):
    client.post("/api/v1/astronauts", json={
        "id": "AST-ML",
        "display_name": "ML Subject",
        "mission_code": "ARTEMIS-III",
        "role": "Scientist"
    })
    # Inject 5 telemetry points
    for hr in [115, 120, 125, 130, 135]:
        client.post("/api/v1/readings", json={
            "astronaut_id": "AST-ML",
            "metric": "heart_rate",
            "value": float(hr),
            "unit": "bpm"
        })
    client.post("/api/v1/readings", json={
        "astronaut_id": "AST-ML",
        "metric": "spo2",
        "value": 89.0,
        "unit": "%"
    })

    ml_res = client.post("/api/v1/ml/analyze", json={
        "astronaut_id": "AST-ML",
        "window_minutes": 15
    })
    assert ml_res.status_code == 200
    data = ml_res.json()
    assert data["is_experimental"] is True
    assert "score" in data
    assert "flag" in data
    assert "explanation" in data

def test_offline_sync_queue(client):
    # Disconnect DSN link
    client.post("/api/v1/sync/toggle-connection?connected=false")
    status = client.get("/api/v1/sync/status").json()
    assert status["is_connected_to_earth"] is False

    # Create astronaut and reading while offline
    client.post("/api/v1/astronauts", json={
        "id": "AST-OFFLINE",
        "display_name": "Offline Subject",
        "mission_code": "ARTEMIS-III",
        "role": "Pilot"
    })
    client.post("/api/v1/readings", json={
        "astronaut_id": "AST-OFFLINE",
        "metric": "heart_rate",
        "value": 75.0,
        "unit": "bpm"
    })

    status_queued = client.get("/api/v1/sync/status").json()
    assert status_queued["pending_count"] >= 1

    # Reconnect and flush
    client.post("/api/v1/sync/toggle-connection?connected=true")
    flush_res = client.post("/api/v1/sync/flush").json()
    assert flush_res["success"] is True
    assert flush_res["synced_count"] >= 1

    status_synced = client.get("/api/v1/sync/status").json()
    assert status_synced["pending_count"] == 0
