import io
import os
os.environ.setdefault('DATABASE_URL','sqlite+pysqlite:///:memory:')
os.environ.setdefault('JWT_SECRET','test-only-secret-32-characters-minimum-123456')
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
from app.models.entities import User, Doctor, Prediction
from app.security.auth import hash_password

def test_analysis_permission_integrity_and_persistence(tmp_path, monkeypatch):
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    private=tmp_path/'private.pem';public=tmp_path/'public.pem'
    private.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    public.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo))
    settings=get_settings()
    monkeypatch.setattr(settings,'image_private_key_path',str(private))
    monkeypatch.setattr(settings,'image_public_key_path',str(public))
    monkeypatch.setattr(settings,'image_storage_dir',str(tmp_path/'encrypted'))
    import app.api.analysis as module
    calls=[]
    def fake_inference(raw):
        calls.append(raw)
        return {'label':'NORMAL','confidence':0.75,'probabilities':{'NORMAL':0.75,'PNEUMONIA':0.25},'model_version':'test-model','disclaimer':'Research only'}, b'fake-png'
    monkeypatch.setattr(module,'analyze_image',fake_inference)
    engine=create_engine('sqlite+pysqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine);factory=sessionmaker(bind=engine)
    def override():
        with factory() as db:yield db
    app.dependency_overrides[get_db]=override
    try:
        with factory() as db:
            db.add_all([User(email='admin@sample.org',password_hash=hash_password('VerySecurePass123!'),role='admin'),User(email='doctor@sample.org',password_hash=hash_password('VerySecurePass123!'),role='doctor')]);db.commit()
            doctor=db.scalar(select(User).where(User.email=='doctor@sample.org'))
            db.add(Doctor(user_id=doctor.id));db.commit()
        with TestClient(app) as c:
            assert c.post('/api/auth/register',json={'email':'patient@sample.org','password':'VerySecurePass123!'}).status_code==201
            def login(email):
                r=c.post('/api/auth/login',json={'email':email,'password':'VerySecurePass123!'})
                assert r.status_code==200,r.text
                return {'Authorization':'Bearer '+r.json()['access_token']}
            patient=login('patient@sample.org');doctor=login('doctor@sample.org');admin=login('admin@sample.org')
            buf=io.BytesIO();Image.new('RGB',(16,16)).save(buf,format='PNG');original=buf.getvalue()
            upload=c.post('/api/images',files={'file':('test.png',original,'image/png')},headers=patient)
            assert upload.status_code==201,upload.text
            rid=upload.json()['id']
            assert c.post(f'/api/analysis/{rid}',headers=admin).status_code==404
            assert c.post(f'/api/analysis/{rid}',headers=doctor).status_code==404
            assert not calls
            r=c.post(f'/api/analysis/{rid}',headers=patient)
            assert r.status_code==200,r.text
            assert r.json()['gradcam_png_base64']=='ZmFrZS1wbmc='
            assert calls==[original]
            with factory() as db: assert len(db.scalars(select(Prediction)).all())==1
            assert len(c.get(f'/api/analysis/{rid}/history',headers=patient).json())==1
            path=tmp_path/'encrypted'/f'{rid}.enc';tampered=bytearray(path.read_bytes());tampered[-1]^=1;path.write_bytes(tampered)
            assert c.post(f'/api/analysis/{rid}',headers=patient).status_code==409
            assert len(calls)==1
    finally:
        app.dependency_overrides.clear();engine.dispose()
