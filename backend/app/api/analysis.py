"""Authorized model inference; encrypted source and Grad-CAM never stored in plaintext."""
import base64
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import User, XrayRecord, EncryptionMetadata, Prediction
from app.security.auth import get_current_user
from app.api.images import audit, can_read
from app.crypto.images import encrypted_path, decrypt_bytes
from app.ml.inference import analyze_image, DISCLAIMER

router = APIRouter(prefix='/analysis', tags=['AI X-ray analysis'])

def allowed_record(db, user, record_id):
    try: uuid.UUID(record_id)
    except ValueError: raise HTTPException(404,'Image not found')
    record = db.get(XrayRecord,record_id)
    if not record or not can_read(db,user,record):
        audit(db,user,'xray.analysis','denied',record_id); db.commit()
        raise HTTPException(404,'Image not found')
    return record

@router.post('/{record_id}')
def analyze(record_id: str, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    record = allowed_record(db,user,record_id)
    metadata = db.scalar(select(EncryptionMetadata).where(EncryptionMetadata.xray_id==record.id))
    try:
        if not metadata or metadata.algorithm!='AES-256-GCM+RSA-OAEP-SHA256': raise ValueError('Invalid encryption metadata')
        raw = decrypt_bytes(encrypted_path(record.id).read_bytes(),metadata.nonce,metadata.wrapped_key,record.id,record.original_sha256)
    except Exception:
        audit(db,user,'xray.analysis.integrity','failed',record_id); db.commit()
        raise HTTPException(409,'Encrypted image integrity verification failed')
    try:
        result, heatmap = analyze_image(raw)
    except FileNotFoundError:
        raise HTTPException(503,'Model checkpoint unavailable. Train and configure the model first.')
    except Exception:
        # Do not expose stack traces or decrypted content in API responses.
        raise HTTPException(500,'Model inference failed')
    db.add(Prediction(xray_id=record.id,model_version=result['model_version'],label=result['label'],confidence=result['confidence'],gradcam_path=None))
    audit(db,user,'xray.analysis','success',record.id)
    db.commit()
    return {**result,'gradcam_png_base64':base64.b64encode(heatmap).decode('ascii')}

@router.get('/{record_id}/history')
def history(record_id: str, user: Annotated[User,Depends(get_current_user)], db: Annotated[Session,Depends(get_db)]):
    record = allowed_record(db,user,record_id)
    rows = db.scalars(select(Prediction).where(Prediction.xray_id==record.id).order_by(Prediction.created_at.desc())).all()
    return [{'id':r.id,'label':r.label,'confidence':r.confidence,'model_version':r.model_version,'created_at':r.created_at,'disclaimer':DISCLAIMER} for r in rows]
