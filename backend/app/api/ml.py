from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Astronaut, ModelResult
from app.schemas import ModelAnalysisRequest, ModelAnalysisResponse
from app.services.ml_service import ml_service

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.post("/analyze", response_model=ModelAnalysisResponse)
def analyze_telemetry_window(req: ModelAnalysisRequest, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == req.astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut not found.")

    res = ml_service.analyze_window(db, req.astronaut_id, req.window_minutes)
    return res

@router.get("/history/{astronaut_id}")
def get_ml_history(astronaut_id: str, db: Session = Depends(get_db)):
    results = db.query(ModelResult).filter(
        ModelResult.astronaut_id == astronaut_id
    ).order_by(ModelResult.created_at.desc()).limit(20).all()
    
    return [
        {
            "id": r.id,
            "window_start": r.window_start.isoformat(),
            "window_end": r.window_end.isoformat(),
            "model_version": r.model_version,
            "score": r.score,
            "flag": r.flag,
            "explanation": r.explanation,
            "created_at": r.created_at.isoformat(),
            "is_experimental": True
        }
        for r in results
    ]

