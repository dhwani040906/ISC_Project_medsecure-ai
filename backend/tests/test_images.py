import io
import os
from pathlib import Path
os.environ.setdefault('DATABASE_URL', 'sqlite+pysqlite:///:memory:')
os.environ.setdefault('JWT_SECRET', 'test-only-secret-32-characters-minimum-123456')
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
from app.models.entities import User, Doctor, XrayRecord, PatientDoctorPermission
from app.security.auth import hash_password

def test_encrypted_upload_access_revocation_and_tamper(tmp_path, monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = tmp_path/'private.pem'; public = tmp_path/'public.pem'
    private.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    public.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    settings = get_settings()
    monkeypatch.setattr(settings, 'image_private_key_path', str(private))
    monkeypatch.setattr(settings, 'image_public_key_path', str(public))
    monkeypatch.setattr(settings, 'image_storage_dir', str(tmp_path/'encrypted'))
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def override():
        with factory() as db: yield db
    app.dependency_overrides[get_db] = override
    try:
        with factory() as db:
            db.add_all([User(email='admin@test.org', password_hash=hash_password('VerySecurePass123!'), role='admin'), User(email='doctor@test.org', password_hash=hash_password('VerySecurePass123!'), role='doctor')]); db.commit()
            doctor = db.scalar(select(User).where(User.email == 'doctor@test.org'))
            db.add(Doctor(user_id=doctor.id)); db.commit()
        with TestClient(app) as c:
            r = c.post('/api/auth/register', json={'email':'patient@test.org','password':'VerySecurePass123!'})
            assert r.status_code == 201, r.text
            def login(email):
                r = c.post('/api/auth/login', json={'email':email,'password':'VerySecurePass123!'})
                assert r.status_code == 200, r.text
                return {'Authorization':'Bearer '+r.json()['access_token']}
            patient = login('patient@test.org'); doctor = login('doctor@test.org'); admin = login('admin@test.org')
            buf=io.BytesIO(); Image.new('RGB',(10,10)).save(buf,format='PNG'); original=buf.getvalue()
            r=c.post('/api/images',files={'file':('test.png',original,'image/png')},headers=patient)
            assert r.status_code==201,r.text
            rid=r.json()['id']
            ciphertext=(tmp_path/'encrypted'/f'{rid}.enc').read_bytes()
            assert ciphertext != original and original not in ciphertext
            assert c.get(f'/api/images/{rid}/download',headers=doctor).status_code==404
            assert c.get(f'/api/images/{rid}/download',headers=admin).status_code==404
            assert c.get(f'/api/images/{rid}/download',headers=patient).content==original
            with factory() as db: did=db.scalar(select(Doctor.id))
            assert c.post(f'/api/images/permissions/{did}',headers=patient).status_code==201
            assert c.get(f'/api/images/{rid}/download',headers=doctor).content==original
            assert c.delete(f'/api/images/permissions/{did}',headers=patient).status_code==204
            assert c.get(f'/api/images/{rid}/download',headers=doctor).status_code==404
            path=tmp_path/'encrypted'/f'{rid}.enc'; changed=bytearray(path.read_bytes()); changed[-1]^=1;path.write_bytes(changed)
            assert c.get(f'/api/images/{rid}/download',headers=patient).status_code==409
            assert c.post('/api/images',files={'file':('bad.png',b'not a picture','image/png')},headers=patient).status_code==415
    finally:
        app.dependency_overrides.clear(); engine.dispose()
