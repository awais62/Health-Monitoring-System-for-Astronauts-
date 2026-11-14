import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import SyncQueue

class SyncService:
    def __init__(self):
        # Simulated DSN (Deep Space Network) link status
        self.is_connected_to_earth: bool = True

    def set_connection_status(self, connected: bool):
        self.is_connected_to_earth = connected

    def enqueue_record(self, db: Session, record_type: str, payload: Dict[str, Any]) -> SyncQueue:
        queue_item = SyncQueue(
            record_type=record_type,
            payload_json=json.dumps(payload),
            sync_status="PENDING",
            retry_count=0,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(queue_item)
        db.commit()
        db.refresh(queue_item)
        return queue_item

    def get_queue_status(self, db: Session) -> Dict[str, Any]:
        pending = db.query(SyncQueue).filter(SyncQueue.sync_status == "PENDING").count()
        synced = db.query(SyncQueue).filter(SyncQueue.sync_status == "SYNCED").count()
        failed = db.query(SyncQueue).filter(SyncQueue.sync_status == "FAILED").count()
        return {
            "is_connected_to_earth": self.is_connected_to_earth,
            "pending_count": pending,
            "synced_count": synced,
            "failed_count": failed,
            "total_records": pending + synced + failed
        }

    def flush_sync_queue(self, db: Session) -> Dict[str, Any]:
        """
        Demonstrates Deep Space Network telemetry dump when line-of-sight is restored.
        """
        if not self.is_connected_to_earth:
            return {
                "success": False,
                "message": "Cannot synchronize: Earth Ground Station communication link is DOWN (DSN Blackout)."
            }

        pending_items = db.query(SyncQueue).filter(SyncQueue.sync_status == "PENDING").all()
        synced_count = 0
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        for item in pending_items:
            item.sync_status = "SYNCED"
            item.synced_at = now
            synced_count += 1

        db.commit()
        return {
            "success": True,
            "synced_count": synced_count,
            "synced_at": now.isoformat(),
            "message": f"Successfully synchronized {synced_count} queued telemetry packets with Earth MCC."
        }

sync_service = SyncService()

