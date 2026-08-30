from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.connection import get_db

# Import routers
from app.routers import tab1_router, tab2_router, resources, auth

app = FastAPI(
    title="Mood9 Compliance Engine API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router)
app.include_router(tab1_router.router)
app.include_router(tab2_router.router)
app.include_router(resources.router)

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "compliance-engine-api"}


@app.get("/api/v1/health")
def health_check_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "database": "connected"}