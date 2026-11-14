from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse
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

# Root route: Provides clean status & immediate link to Swagger docs
@app.get("/", response_class=HTMLResponse, tags=["System"])
def root_status():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>BioAegis-Space Gateway</title>
        <style>
            body { background: #090d16; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 32px 40px; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            h1 { font-size: 20px; font-weight: 700; color: #38bdf8; margin: 0 0 8px 0; }
            p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px 0; }
            .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; margin-bottom: 16px; }
            .links { display: flex; gap: 12px; }
            a { background: #0284c7; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; transition: background 0.15s; }
            a:hover { background: #0369a1; }
            a.secondary { background: #1e293b; color: #e2e8f0; }
            a.secondary:hover { background: #334155; }
        </style>
    </head>
    <body>
        <div class="card">
            <span class="badge">&#9679; BACKEND ONLINE & STREAMING</span>
            <h1>BioAegis-Space Telemetry API</h1>
            <p>The FastAPI microservice is actively running. Telemetry ingestion, deterministic safety rules, ML anomaly detection, and WebSocket broadcasting are operational.</p>
            <div class="links">
                <a href="/docs">Interactive API Docs (Swagger)</a>
                <a href="/healthz" class="secondary">Health Check (/healthz)</a>
                <a href="http://localhost:5173" class="secondary" target="_blank">Mission Control UI</a>
            </div>
        </div>
    </body>
    </html>
    """

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
