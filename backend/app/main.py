from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.services.rules_engine import init_default_thresholds
from app.services.simulator_service import simulator_service
from app.api.websockets import ws_manager

from app.api.astronauts import router as astronauts_router
from app.api.readings import router as readings_router
from app.api.alerts import router as alerts_router
from app.api.ml import router as ml_router
from app.api.reports import router as reports_router
from app.api.sync import router as sync_router
from app.api.simulator import router as simulator_router
from app.api.websockets import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bioaegis")

background_sim_running = True

async def telemetry_background_loop():
    """Autonomous telemetry background ticker for connected astronauts."""
    while background_sim_running:
        try:
            await asyncio.sleep(2.0)
            db = SessionLocal()
            try:
                # Generate telemetry tick for all active astronauts
                for astro_id in ["AST-01", "AST-02", "AST-03", "AST-04"]:
                    readings = simulator_service.generate_tick(db, astro_id)
                    # Broadcast over websocket to live UI clients
                    await ws_manager.broadcast({
                        "event": "TELEMETRY_TICK",
                        "astronaut_id": astro_id,
                        "data": readings
                    })
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Telemetry loop error: {e}")
            await asyncio.sleep(2.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Initializing BioAegis-Space Database Schema...")
    Base.metadata.create_all(bind=engine)

    # Seed baseline thresholds and astronaut profiles
    db = SessionLocal()
    try:
        init_default_thresholds(db)
        simulator_service.seed_astronauts(db)
        logger.info("Seeded default astronauts and threshold configs.")
    finally:
        db.close()

    # Launch background telemetry generator
    sim_task = asyncio.create_task(telemetry_background_loop())
    logger.info("Autonomous telemetry generator running.")

    yield

    # Shutdown sequence
    global background_sim_running
    background_sim_running = False
    sim_task.cancel()
    logger.info("BioAegis-Space shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Offline-first telemetry monitoring, rules engine, and ML anomaly detector for crewed spaceflight missions.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(astronauts_router, prefix=settings.API_V1_STR)
app.include_router(readings_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(ml_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(sync_router, prefix=settings.API_V1_STR)
app.include_router(simulator_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)

@app.get("/healthz", tags=["System"])
def health_check():
    return {
        "status": "HEALTHY",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "SPACE_MISSION_PROTOTYPE"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
