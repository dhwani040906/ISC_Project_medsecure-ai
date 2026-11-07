from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import User, Patient, Doctor, AuditLog
from app.security.auth import require_roles

router = APIRouter(tags=["Dashboards"])

@router.get("/patient/dashboard")
def patient_dashboard(user: Annotated[User, Depends(require_roles("patient"))], db: Annotated[Session, Depends(get_db)]):
    patient = db.scalar(select(Patient).where(Patient.user_id == user.id))
    return {"role": "patient", "email": user.email, "pseudonym": patient.pseudonym if patient else None, "message": "Patient access verified; scans available in Phase 3."}

@router.get("/doctor/dashboard")
def doctor_dashboard(user: Annotated[User, Depends(require_roles("doctor"))]):
    return {"role": "doctor", "email": user.email, "message": "Doctor access verified; assigned records available in later phases."}

@router.get("/admin/dashboard")
def admin_dashboard(user: Annotated[User, Depends(require_roles("admin"))], db: Annotated[Session, Depends(get_db)]):
    return {"role": "admin", "users": db.scalar(select(func.count(User.id))), "doctors": db.scalar(select(func.count(Doctor.id))), "patients": db.scalar(select(func.count(Patient.id)))}
