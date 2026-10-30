from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import init_db, get_db, SessionLocal
from app.seed_data import seed_database
from app.models import Pipeline
from app.schemas import HealthResponse
from app.routers import pipelines, simulation, recovery, audit


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Initializes database tables and loads demo seed data on startup.
    """
    print("[OpsPilot AI] Starting up: initializing database tables...")
    init_db()

    # Seed demo data if database is empty or missing initial records
    db = SessionLocal()
    try:
        seed_result = seed_database(db)
        print(f"[OpsPilot AI] Seeding status: {seed_result['message']}")
    except Exception as exc:
        print(f"[OpsPilot AI] Warning during initial seed: {exc}")
    finally:
        db.close()

    yield

    print("[OpsPilot AI] Shutting down cleanly.")


app = FastAPI(
    title="OpsPilot AI — Operations Recovery Platform",
    description="Intelligent Data Pipeline Operations Recovery & Business Impact Analysis API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for Vite React frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(pipelines.router)
app.include_router(simulation.router)
app.include_router(recovery.router)
app.include_router(audit.router)


@app.get("/", tags=["Root"])
def read_root():
    """
    Root endpoint returning system metadata and navigation links.
    """
    return {
        "app": "OpsPilot AI",
        "description": "Intelligent Operations Recovery and Business Impact Analysis Platform",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "status": "online",
        "modules": [
            "/api/pipelines",
            "/api/incidents",
            "/api/simulate/fail",
            "/api/audit-logs",
        ],
    }


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint to verify API and database connectivity.
    """
    db.execute(text("SELECT 1"))
    pipeline_count = db.query(Pipeline).count()

    return HealthResponse(
        status="ok",
        app="OpsPilot AI",
        version="1.0.0",
        database="connected",
        pipelines_count=pipeline_count,
    )
