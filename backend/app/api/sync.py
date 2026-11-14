from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.sync_service import sync_service

router = APIRouter(prefix="/sync", tags=["Offline & Synchronization"])

@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    return sync_service.get_queue_status(db)

@router.post("/toggle-connection")
def toggle_connection(connected: bool):
    sync_service.set_connection_status(connected)
    return {
        "is_connected_to_earth": sync_service.is_connected_to_earth,
        "message": "Deep Space Network (DSN) link status updated."
    }

@router.post("/flush")
def flush_sync_queue(db: Session = Depends(get_db)):
    return sync_service.flush_sync_queue(db)

