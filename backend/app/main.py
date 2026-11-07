
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.dashboards import router as dashboard_router
from app.api.images import router as images_router
from app.api.analysis import router as analysis_router
from app.api.reports import router as reports_router
from app.api.audit import router as audit_router

from app.api.clinical_reviews import router as clinical_review_router

settings = get_settings()

app = FastAPI(
    title="MedSecure AI API",
    version="0.6.1",
    description="MedSecure AI: Secure medical imaging, AI analysis, "
                "signed reports, and security auditing",
)

# CORS configuration
allowed_origins = list(
    dict.fromkeys([
        settings.frontend_origin.rstrip("/"),
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ])
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)

# API routes
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(images_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(audit_router, prefix="/api")

app.include_router(clinical_review_router, prefix="/api")
