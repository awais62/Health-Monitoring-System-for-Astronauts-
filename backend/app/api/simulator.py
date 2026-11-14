from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
from app.database import get_db
from app.models import Astronaut
from app.services.simulator_service import simulator_service

router = APIRouter(prefix="/simulator", tags=["Telemetry Simulator"])

class ScenarioUpdateRequest(BaseModel):
    astronaut_id: str
    scenario: str  # NOMINAL, HYPOXIA, EVA_EXERCISE, ARRHYTHMIA, HYPOTHERMIA

@router.post("/tick/{astronaut_id}")
def trigger_telemetry_tick(astronaut_id: str, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut not found.")

    readings = simulator_service.generate_tick(db, astronaut_id)
    return {
        "astronaut_id": astronaut_id,
        "scenario": simulator_service.scenarios.get(astronaut_id, "NOMINAL"),
        "readings_emitted": len(readings),
        "data": readings
    }

@router.post("/scenario")
def set_astronaut_scenario(req: ScenarioUpdateRequest):
    valid_scenarios = ["NOMINAL", "HYPOXIA", "EVA_EXERCISE", "ARRHYTHMIA", "HYPOTHERMIA"]
    if req.scenario not in valid_scenarios:
        raise HTTPException(status_code=400, detail=f"Invalid scenario. Allowed: {valid_scenarios}")

    simulator_service.set_scenario(req.astronaut_id, req.scenario)
    return {
        "astronaut_id": req.astronaut_id,
        "active_scenario": req.scenario,
        "message": f"Astronaut '{req.astronaut_id}' scenario transitioned to '{req.scenario}'."
    }

@router.get("/status")
def get_simulator_status():
    return {
        "is_auto_generating": simulator_service.is_auto_generating,
        "scenarios": simulator_service.scenarios
    }

@router.post("/toggle")
def toggle_simulator(active: bool):
    simulator_service.toggle_auto_generation(active)
    return {
        "is_auto_generating": simulator_service.is_auto_generating,
        "message": "Autonomous telemetry generation " + ("STARTED" if active else "PAUSED")
    }

@router.get("/scenarios")
def get_current_scenarios():
    return simulator_service.scenarios

