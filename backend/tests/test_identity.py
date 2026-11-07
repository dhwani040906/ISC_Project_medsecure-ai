import os
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-only-secret-32-characters-minimum-123456")
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
import app.models
from app.db.dependencies import get_db
from app.main import app
from app.models.entities import User
from app.security.auth import hash_password
from app.security.display import reference

def test_identity_and_access():
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def override():
        with factory() as db: yield db
    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as c:
            r=c.post('/api/auth/register',json={'email':'person@example.com','password':'StrongPassword123!','full_name':'Asha Patel','username':'asha.patel'})
            assert r.status_code == 201, r.text
            assert r.json()['full_name'] == 'Asha Patel'
            assert c.post('/api/auth/register',json={'email':'other@example.com','password':'StrongPassword123!','full_name':'Other Person','username':'ASHA.PATEL'}).status_code == 409
            login=c.post('/api/auth/login',json={'email':'person@example.com','password':'StrongPassword123!'})
            h={'Authorization':'Bearer '+login.json()['access_token']}
            assert c.patch('/api/auth/me/profile',json={'full_name':'Asha P. Patel','username':'asha.new'},headers=h).json()['username']=='asha.new'
            assert c.get('/api/auth/me',headers=h).json()['full_name']=='Asha P. Patel'
            with factory() as db:
                db.add(User(email='admin@example.com',password_hash=hash_password('StrongPassword123!'),role='admin'))
                db.commit()
            a=c.post('/api/auth/login',json={'email':'admin@example.com','password':'StrongPassword123!'})
            ah={'Authorization':'Bearer '+a.json()['access_token']}
            d=c.post('/api/auth/doctors',json={'email':'doctor@example.com','password':'StrongPassword123!','full_name':'Dr Meera Rao','username':'dr.meera'},headers=ah)
            assert d.status_code == 201, d.text
            assert d.json()['full_name']=='Dr Meera Rao'
            assert c.patch('/api/auth/me/profile',json={'full_name':'Admin Name','username':'adminuser'},headers=ah).status_code == 403
            assert reference('XR','ff5b8213-6121-4c65-ba86-e16e8c7c8a74')=='XR-FF5B82136121'
    finally:
        app.dependency_overrides.clear(); engine.dispose()
