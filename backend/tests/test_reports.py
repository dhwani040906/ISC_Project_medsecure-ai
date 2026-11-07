"""Phase 5 end-to-end: PDF encryption, detached signature, RBAC, tampering."""
import io
import os
os.environ.setdefault('DATABASE_URL', 'sqlite+pysqlite:///:memory:')
os.environ.setdefault('JWT_SECRET', 'test-only-secret-32-characters-minimum-123456')
from pathlib import Path
from PIL import Image
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.db.base import Base
from app.db.dependencies import get_db
from app.main import app
from app.models.entities import User, Doctor, Prediction, MedicalReport, DigitalSignature
from app.security.auth import hash_password


def test_report_signing_encryption_access_and_tampering(tmp_path, monkeypatch):
    settings = get_settings()
    for stem, priv_attr, pub_attr in [
        ('wrap','image_private_key_path','image_public_key_path'),
        ('sign','report_signing_private_key_path','report_signing_public_key_path'),
    ]:
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        private = tmp_path / f'{stem}_private.pem'
        public = tmp_path / f'{stem}_public.pem'
        private.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
        public.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo))
        monkeypatch.setattr(settings, priv_attr, str(private))
        monkeypatch.setattr(settings, pub_attr, str(public))
    monkeypatch.setattr(settings,'image_storage_dir',str(tmp_path/'images'))
    monkeypatch.setattr(settings,'report_storage_dir',str(tmp_path/'reports'))
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def override():
        with factory() as db: yield db
    app.dependency_overrides[get_db] = override
    try:
        with factory() as db:
            db.add_all([User(email='admin-report@sample.org',password_hash=hash_password('VerySecurePass123!'),role='admin'),User(email='doctor-report@sample.org',password_hash=hash_password('VerySecurePass123!'),role='doctor')]);db.commit()
            doctor=db.scalar(select(User).where(User.email=='doctor-report@sample.org'))
            db.add(Doctor(user_id=doctor.id));db.commit()
        with TestClient(app) as c:
            assert c.post('/api/auth/register',json={'email':'patient-report@sample.org','password':'VerySecurePass123!'}).status_code==201
            def auth(email):
                r=c.post('/api/auth/login',json={'email':email,'password':'VerySecurePass123!'})
                assert r.status_code==200,r.text
                return {'Authorization':'Bearer '+r.json()['access_token']}
            patient=auth('patient-report@sample.org');admin=auth('admin-report@sample.org');doctor=auth('doctor-report@sample.org')
            buf=io.BytesIO();Image.new('RGB',(16,16)).save(buf,format='PNG')
            r=c.post('/api/images',files={'file':('xray.png',buf.getvalue(),'image/png')},headers=patient)
            assert r.status_code==201,r.text
            xray_id=r.json()['id']
            with factory() as db:
                pred=Prediction(xray_id=xray_id,model_version='test-model',label='PNEUMONIA',confidence=0.91)
                db.add(pred);db.commit();prediction_id=pred.id
            assert c.post(f'/api/reports/predictions/{prediction_id}',headers=admin).status_code==404
            assert c.post(f'/api/reports/predictions/{prediction_id}',headers=doctor).status_code==404
            r=c.post(f'/api/reports/predictions/{prediction_id}',headers=patient)
            assert r.status_code==201,r.text
            report_id=r.json()['id']
            with factory() as db:
                assert db.get(MedicalReport,report_id)
                assert db.scalar(select(DigitalSignature).where(DigitalSignature.report_id==report_id))
            encrypted=(tmp_path/'reports'/f'{report_id}.enc').read_bytes()
            assert not encrypted.startswith(b'%PDF')
            verify=c.get(f'/api/reports/{report_id}/verify',headers=patient)
            assert verify.status_code==200 and verify.json()['verified'] is True
            download=c.get(f'/api/reports/{report_id}/download',headers=patient)
            assert download.status_code==200 and download.content.startswith(b'%PDF')
            assert c.get(f'/api/reports/{report_id}/download',headers=admin).status_code==404
            assert c.get(f'/api/reports/{report_id}/download',headers=doctor).status_code==404
            with factory() as db:
                sig=db.scalar(select(DigitalSignature).where(DigitalSignature.report_id==report_id))
                original_signature=sig.signature
                changed=bytearray(original_signature);changed[-1]^=1
                sig.signature=bytes(changed);db.commit()
            assert c.get(f'/api/reports/{report_id}/verify',headers=patient).json()['verified'] is False
            assert c.get(f'/api/reports/{report_id}/download',headers=patient).status_code==409
            with factory() as db:
                sig=db.scalar(select(DigitalSignature).where(DigitalSignature.report_id==report_id))
                sig.signature=original_signature;db.commit()
            path=tmp_path/'reports'/f'{report_id}.enc';tampered=bytearray(path.read_bytes());tampered[-1]^=1;path.write_bytes(tampered)
            assert c.get(f'/api/reports/{report_id}/verify',headers=patient).json()['verified'] is False
            assert c.get(f'/api/reports/{report_id}/download',headers=patient).status_code==409
    finally:
        app.dependency_overrides.clear();engine.dispose()
