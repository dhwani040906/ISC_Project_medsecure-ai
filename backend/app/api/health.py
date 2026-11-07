from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.db.session import engine

router = APIRouter(tags=["Health"])

@router.get("/health")
def health():
    return {"status": "ok", "service": "MedSecure AI API"}

@router.get("/health/database")
def database_health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "connected"}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable")
