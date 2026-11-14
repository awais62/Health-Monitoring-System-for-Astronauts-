from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "BioAegis-Space Health Monitoring System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database URL: SQLite default with clean path or PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bioaegis.db")
    
    # CORS Origins for Vite Frontend
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Medical Telemetry Standards & Limits
    SAMPLING_INTERVAL_SECONDS: float = 1.0
    ROLLING_WINDOW_SIZE: int = 60
    
    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
