import os
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-only-secret-32-characters-minimum-123456")

import pytest
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

@pytest.fixture
def client():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def override():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c, factory
    app.dependency_overrides.clear()
    engine.dispose()

def test_register_login_logout_and_rbac(client):
    c, factory = client
    payload = {"email": "Patient@Example.com", "password": "SecurePassphrase123!"}
    r = c.post("/api/auth/register", json=payload)
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "patient"
    assert c.post("/api/auth/register", json=payload).status_code == 409
    assert c.post("/api/auth/login", json={**payload, "password": "wrong"}).status_code == 401
    r = c.post("/api/auth/login", json=payload)
    assert r.status_code == 200, r.text
    headers = {"Authorization": "Bearer " + r.json()["access_token"]}
    assert c.get("/api/auth/me", headers=headers).json()["email"] == "patient@example.com"
    assert c.get("/api/patient/dashboard", headers=headers).status_code == 200
    assert c.get("/api/doctor/dashboard", headers=headers).status_code == 403
    assert c.get("/api/admin/dashboard", headers=headers).status_code == 403
    assert c.post("/api/auth/doctors", json={"email": "doctor@example.com", "password": "SecurePassphrase123!"}, headers=headers).status_code == 403
    assert c.post("/api/auth/logout", headers=headers).status_code == 204
    assert c.get("/api/auth/me", headers=headers).status_code == 401

def test_admin_creates_doctor(client):
    c, factory = client
    with factory() as db:
        db.add(User(email="admin@example.com", password_hash=hash_password("AdminPassphrase123!"), role="admin"))
        db.commit()
    token = c.post("/api/auth/login", json={"email": "admin@example.com", "password": "AdminPassphrase123!"}).json()["access_token"]
    headers = {"Authorization": "Bearer " + token}
    assert c.get("/api/admin/dashboard", headers=headers).status_code == 200
    r = c.post("/api/auth/doctors", json={"email": "doctor@example.com", "password": "DoctorPassphrase123!", "license_reference": "DEMO-001"}, headers=headers)
    assert r.status_code == 201, r.text
    doctor_token = c.post("/api/auth/login", json={"email": "doctor@example.com", "password": "DoctorPassphrase123!"}).json()["access_token"]
    dh = {"Authorization": "Bearer " + doctor_token}
    assert c.get("/api/doctor/dashboard", headers=dh).status_code == 200
    assert c.get("/api/patient/dashboard", headers=dh).status_code == 403

def test_lockout(client):
    c, _ = client
    for _ in range(5):
        assert c.post("/api/auth/login", json={"email": "missing@example.com", "password": "wrong"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "missing@example.com", "password": "wrong"}).status_code == 429
