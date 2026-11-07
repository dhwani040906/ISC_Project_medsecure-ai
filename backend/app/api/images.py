import io
import os
import uuid
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import (User, Patient, Doctor, PatientDoctorPermission, XrayRecord, EncryptionMetadata, AuditLog)
from app.security.auth import get_current_user, require_roles
from app.security.display import reference
from app.crypto.images import MAX_BYTES, encrypt_bytes, decrypt_bytes, encrypted_path

router = APIRouter(prefix="/images", tags=["Encrypted X-rays"])

def audit(db, actor, event, result, record_id=None):
    db.add(AuditLog(actor_id=actor.id if actor else None, event_type=event, result=result, record_reference=record_id))

def patient_for(db, user):
    patient = db.scalar(select(Patient).where(Patient.user_id == user.id))
    if not patient:
        raise HTTPException(403, "Patient profile missing")
    return patient

def can_read(db, user, record):
    if user.role == "patient":
        return patient_for(db, user).id == record.patient_id
    if user.role == "doctor":
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
        return bool(doctor and db.scalar(select(PatientDoctorPermission.id).where(
            PatientDoctorPermission.patient_id == record.patient_id,
            PatientDoctorPermission.doctor_id == doctor.id,
            PatientDoctorPermission.revoked_at.is_(None))))
    return False  # Admins manage accounts but cannot read medical images by default.

def validate_image(data, mime):
    if mime not in ("image/png", "image/jpeg"):
        raise HTTPException(415, "Only PNG and JPEG X-rays are supported")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ("PNG", "JPEG"):
                raise HTTPException(415, "Invalid image format")
            if (image.format == "PNG" and mime != "image/png") or (image.format == "JPEG" and mime != "image/jpeg"):
                raise HTTPException(415, "Image content and MIME type disagree")
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(415, "Invalid or corrupt image")

@router.post("", status_code=201)
async def upload_xray(file: Annotated[UploadFile, File()], user: Annotated[User, Depends(require_roles("patient"))], db: Annotated[Session, Depends(get_db)]):
    data = await file.read(MAX_BYTES + 1)
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "Image must be nonempty and at most 10 MiB")
    validate_image(data, file.content_type)
    patient = patient_for(db, user)
    record_id = str(uuid.uuid4())
    ciphertext, nonce, wrapped, sha = encrypt_bytes(data, record_id)
    path = encrypted_path(record_id)
    try:
        with path.open("xb") as handle:
            handle.write(ciphertext)
        db.add(XrayRecord(id=record_id, patient_id=patient.id, encrypted_file_path=str(path), original_sha256=sha, status="uploaded"))
        db.flush()  # insert X-ray parent before encryption metadata
        db.add(EncryptionMetadata(xray_id=record_id, algorithm="AES-256-GCM+RSA-OAEP-SHA256", nonce=nonce, wrapped_key=wrapped, key_reference="image-wrapping-v1"))
        audit(db, user, "xray.upload", "success", record_id)
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    return {"id": record_id, "status": "uploaded", "sha256": sha, "size_bytes": len(data)}

@router.get("")
def list_images(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    if user.role == "patient":
        ids = [patient_for(db, user).id]
    elif user.role == "doctor":
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == user.id))
        ids = list(db.scalars(select(PatientDoctorPermission.patient_id).where(PatientDoctorPermission.doctor_id == doctor.id, PatientDoctorPermission.revoked_at.is_(None)))) if doctor else []
    else:
        raise HTTPException(403, "Medical image access is restricted")
    records = db.scalars(select(XrayRecord).where(XrayRecord.patient_id.in_(ids)).order_by(XrayRecord.uploaded_at.desc())).all()
    patients = {p.id: p for p in db.scalars(select(Patient).where(Patient.id.in_(ids))).all()}
    accounts = {u.id: u for u in db.scalars(select(User).where(User.id.in_([p.user_id for p in patients.values()]))).all()}
    return [{"id": r.id, "reference": reference("XR", r.id), "uploaded_at": r.uploaded_at,
             "status": r.status, "sha256": r.original_sha256,
             "patient_name": accounts[patients[r.patient_id].user_id].full_name if r.patient_id in patients and patients[r.patient_id].user_id in accounts else None,
             "patient_username": accounts[patients[r.patient_id].user_id].username if r.patient_id in patients and patients[r.patient_id].user_id in accounts else None}
            for r in records]

@router.get("/{record_id}/download")
def download_xray(record_id: str, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    try:
        uuid.UUID(record_id)
    except ValueError:
        raise HTTPException(404, "Image not found")
    record = db.get(XrayRecord, record_id)
    if not record or not can_read(db, user, record):
        audit(db, user, "xray.download", "denied", record_id)
        db.commit()
        raise HTTPException(404, "Image not found")
    metadata = db.scalar(select(EncryptionMetadata).where(EncryptionMetadata.xray_id == record_id))
    try:
        if not metadata or metadata.algorithm != "AES-256-GCM+RSA-OAEP-SHA256":
            raise ValueError("Encryption metadata unavailable")
        # Derive path from server-created ID; do not trust DB-stored path for filesystem traversal.
        ciphertext = encrypted_path(record_id).read_bytes()
        plaintext = decrypt_bytes(ciphertext, metadata.nonce, metadata.wrapped_key, record_id, record.original_sha256)
    except Exception:
        audit(db, user, "xray.integrity", "failed", record_id)
        db.commit()
        raise HTTPException(409, "Image unavailable or integrity check failed")
    audit(db, user, "xray.download", "success", record_id)
    db.commit()
    # Determine content type from verified plaintext magic, not filename.
    mime = "image/png" if plaintext.startswith(b"\x89PNG\r\n\x1a\n") else "image/jpeg"
    return Response(content=plaintext, media_type=mime, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

@router.post("/permissions/{doctor_id}", status_code=201)
def grant_doctor(doctor_id: str, user: Annotated[User, Depends(require_roles("patient"))], db: Annotated[Session, Depends(get_db)]):
    patient = patient_for(db, user)
    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    permission = db.scalar(select(PatientDoctorPermission).where(PatientDoctorPermission.patient_id == patient.id, PatientDoctorPermission.doctor_id == doctor_id, PatientDoctorPermission.revoked_at.is_(None)))
    if permission:
        raise HTTPException(409, "Permission already active")
    db.add(PatientDoctorPermission(patient_id=patient.id, doctor_id=doctor_id))
    audit(db, user, "xray.permission.grant", "success")
    db.commit()
    return {"status": "granted", "doctor_id": doctor_id}

@router.delete("/permissions/{doctor_id}", status_code=204)
def revoke_doctor(doctor_id: str, user: Annotated[User, Depends(require_roles("patient"))], db: Annotated[Session, Depends(get_db)]):
    patient = patient_for(db, user)
    permission = db.scalar(select(PatientDoctorPermission).where(PatientDoctorPermission.patient_id == patient.id, PatientDoctorPermission.doctor_id == doctor_id, PatientDoctorPermission.revoked_at.is_(None)))
    if not permission:
        raise HTTPException(404, "Active permission not found")
    from datetime import datetime, timezone
    permission.revoked_at = datetime.now(timezone.utc)
    audit(db, user, "xray.permission.revoke", "success")
    db.commit()
    return Response(status_code=204)

@router.get("/permissions/doctors")
def doctor_directory(user: Annotated[User, Depends(require_roles("patient"))], db: Annotated[Session, Depends(get_db)]):
    rows = db.execute(select(Doctor, User).join(User, Doctor.user_id == User.id).where(User.is_active.is_(True))).all()
    return [{"id": doctor.id, "email": account.email, "full_name": account.full_name, "username": account.username} for doctor, account in rows]
