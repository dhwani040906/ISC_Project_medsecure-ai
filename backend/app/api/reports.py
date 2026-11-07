"""Authorized encrypted research reports with detached RSA-PSS signatures."""
import hashlib
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import (User, Patient, Doctor, XrayRecord, Prediction, MedicalReport, DigitalSignature, ReportEncryptionMetadata)
from app.security.auth import get_current_user
from app.api.images import can_read, audit
from app.crypto.images import encrypt_bytes, decrypt_bytes
from app.crypto.reports import build_pdf, sign_pdf, verify_pdf, report_path

router = APIRouter(prefix='/reports', tags=['Signed research reports'])
ALGORITHM = 'AES-256-GCM+RSA-OAEP-SHA256'
KEY_REFERENCE = 'image-wrapping-v1'
SIGNING_REFERENCE = 'report-signing-v1'

def allowed_prediction(db, user, prediction_id):
    try: uuid.UUID(prediction_id)
    except ValueError: raise HTTPException(404, 'Prediction not found')
    prediction = db.get(Prediction, prediction_id)
    record = db.get(XrayRecord, prediction.xray_id) if prediction else None
    if not record or not can_read(db, user, record):
        audit(db, user, 'report.access', 'denied', prediction_id); db.commit()
        raise HTTPException(404, 'Prediction not found')
    return prediction, record

def allowed_report(db, user, report_id):
    try: uuid.UUID(report_id)
    except ValueError: raise HTTPException(404, 'Report not found')
    report = db.get(MedicalReport, report_id)
    prediction = db.get(Prediction, report.prediction_id) if report else None
    record = db.get(XrayRecord, prediction.xray_id) if prediction else None
    if not record or not can_read(db, user, record):
        audit(db, user, 'report.access', 'denied', report_id); db.commit()
        raise HTTPException(404, 'Report not found')
    return report

def read_verified(db, report):
    meta = db.scalar(select(ReportEncryptionMetadata).where(ReportEncryptionMetadata.report_id == report.id))
    sig = db.scalar(select(DigitalSignature).where(DigitalSignature.report_id == report.id))
    if not meta or not sig or meta.algorithm != ALGORITHM or meta.key_reference != KEY_REFERENCE or sig.public_key_reference != SIGNING_REFERENCE:
        raise ValueError('Report cryptographic metadata missing or unsupported')
    ciphertext = report_path(report.id).read_bytes()
    pdf = decrypt_bytes(ciphertext, meta.nonce, meta.wrapped_key, report.id, report.sha256)
    if not verify_pdf(pdf, sig.signature):
        raise ValueError('Digital signature invalid')
    return pdf

@router.post('/predictions/{prediction_id}', status_code=201)
def create_report(prediction_id: str, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    prediction, record = allowed_prediction(db,user,prediction_id)
    patient = db.get(Patient, record.patient_id)
    if not patient: raise HTTPException(409,'Patient profile unavailable')
    patient_user = db.get(User, patient.user_id)
    doctor_user = user if user.role == "doctor" else None
    report_id = str(uuid.uuid4())
    try:
        pdf = build_pdf(report_id,prediction,patient.pseudonym,record.id,
                        patient_name=patient_user.full_name if patient_user else None,
                        patient_username=patient_user.username if patient_user else None,
                        doctor_name=doctor_user.full_name if doctor_user else None,
                        doctor_username=doctor_user.username if doctor_user else None)
        signature = sign_pdf(pdf)
        ciphertext, nonce, wrapped, sha = encrypt_bytes(pdf,report_id)
    except (OSError, RuntimeError, ValueError):
        raise HTTPException(503,'Report cryptographic service unavailable')
    path = report_path(report_id)
    try:
        with path.open('xb') as f: f.write(ciphertext)
        db.add(MedicalReport(id=report_id,prediction_id=prediction.id,pdf_path=str(path),sha256=sha))
        db.flush()  # parent before child FK rows
        db.add(DigitalSignature(report_id=report_id,signature=signature,public_key_reference=SIGNING_REFERENCE))
        db.add(ReportEncryptionMetadata(report_id=report_id,algorithm=ALGORITHM,nonce=nonce,wrapped_key=wrapped,key_reference=KEY_REFERENCE))
        audit(db,user,'report.create','success',report_id)
        db.commit()
    except Exception:
        db.rollback();path.unlink(missing_ok=True);raise
    return {'id':report_id,'prediction_id':prediction.id,'sha256':sha,'signature_algorithm':'RSA-PSS-SHA256','storage':'encrypted','disclaimer':'Research only; not a medical diagnosis'}

@router.get('/predictions/{prediction_id}')
def list_reports(prediction_id: str, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    allowed_prediction(db,user,prediction_id)
    reports = db.scalars(select(MedicalReport).where(MedicalReport.prediction_id==prediction_id).order_by(MedicalReport.created_at.desc())).all()
    return [{'id':r.id,'prediction_id':r.prediction_id,'created_at':r.created_at,'sha256':r.sha256} for r in reports]

@router.get('/{report_id}/verify')
def verify_report(report_id: str, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    report = allowed_report(db,user,report_id)
    try:
        read_verified(db,report)
    except Exception:
        audit(db,user,'report.verify','failed',report_id);db.commit()
        return {'report_id':report_id,'verified':False,'signature_algorithm':'RSA-PSS-SHA256'}
    audit(db,user,'report.verify','success',report_id);db.commit()
    return {'report_id':report_id,'verified':True,'signature_algorithm':'RSA-PSS-SHA256'}

@router.get('/{report_id}/download')
def download_report(report_id: str, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    report = allowed_report(db,user,report_id)
    try:
        pdf = read_verified(db,report)
    except Exception:
        audit(db,user,'report.integrity','failed',report_id);db.commit()
        raise HTTPException(409,'Report integrity or signature verification failed')
    audit(db,user,'report.download','success',report_id);db.commit()
    return Response(content=pdf,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="research-report-{report_id}.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
