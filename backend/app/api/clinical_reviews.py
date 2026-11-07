"""Physician review notes; distinct from model output and signed research reports."""
import uuid
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import ClinicalReview, Doctor, Prediction, XrayRecord, User
from app.security.auth import get_current_user, require_roles
from app.api.images import can_read, audit

router = APIRouter(prefix="/clinical-reviews", tags=["Clinical reviews"])

class ReviewInput(BaseModel):
    status: Literal["reviewed", "finalized"]
    comments: str = Field(min_length=3, max_length=4000)

def prediction_access(db, user, prediction_id):
    try: uuid.UUID(prediction_id)
    except (ValueError, TypeError): raise HTTPException(404, "Prediction not found")
    prediction = db.get(Prediction, prediction_id)
    record = db.get(XrayRecord, prediction.xray_id) if prediction else None
    if record is None or not can_read(db, user, record):
        raise HTTPException(404, "Prediction not found")
    return prediction

def serialize(db, review):
    doctor = db.get(Doctor, review.doctor_id)
    account = db.get(User, doctor.user_id) if doctor else None
    return {"id": review.id, "prediction_id": review.prediction_id,
            "status": review.status, "comments": review.comments,
            "doctor_name": account.full_name if account else None,
            "created_at": review.created_at}

@router.get("/predictions/{prediction_id}")
def list_reviews(prediction_id: str, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    prediction_access(db, user, prediction_id)
    rows = db.scalars(select(ClinicalReview).where(ClinicalReview.prediction_id == prediction_id).order_by(ClinicalReview.created_at.desc())).all()
    return [serialize(db, row) for row in rows]

@router.post("/predictions/{prediction_id}", status_code=201)
def submit_review(prediction_id: str, data: ReviewInput, user: Annotated[User, Depends(require_roles("doctor"))], db: Annotated[Session, Depends(get_db)]):
    prediction_access(db, user, prediction_id)
    doctor = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
    if not doctor: raise HTTPException(403, "Doctor profile unavailable")
    previous = db.scalar(select(ClinicalReview).where(ClinicalReview.prediction_id == prediction_id, ClinicalReview.doctor_id == doctor.id))
    if previous: raise HTTPException(409, "You already reviewed this prediction. Reviews are immutable.")
    comments = data.comments.strip()
    if len(comments) < 3: raise HTTPException(422, "Review comments are too short")
    review = ClinicalReview(prediction_id=prediction_id, doctor_id=doctor.id, status=data.status, comments=comments)
    db.add(review)
    audit(db, user, "clinical_review.create", "success", prediction_id)
    db.commit()
    db.refresh(review)
    return serialize(db, review)
