import os
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-only-secret-32-characters-minimum-123456")
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.base import Base
import app.models
from app.db.dependencies import get_db
from app.main import app
from app.models.entities import AuditLog, AuditChainEntry, User
from app.security.audit_chain import verify_chain
from app.security.auth import hash_password

def test_chain_tampering_and_admin_access():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def override():
        with factory() as db: yield db
    app.dependency_overrides[get_db] = override
    try:
        with factory() as db:
            db.add_all([User(email="admin6@example.com", password_hash=hash_password("SecurePassphrase123!"), role="admin"), AuditLog(event_type="test.event", result="success")])
            db.commit()
            assert verify_chain(db)["valid"]
        with TestClient(app) as c:
            assert c.get("/api/audit/events").status_code == 401
            admin_token = c.post("/api/auth/login", json={"email":"admin6@example.com", "password":"SecurePassphrase123!"}).json()["access_token"]
            h={"Authorization": "Bearer " + admin_token}
            assert c.get("/api/audit/verify", headers=h).json()["valid"]
            assert c.get("/api/audit/events", headers=h).status_code == 200
            assert c.get("/api/audit/summary", headers=h).status_code == 200
            with factory() as db:
                row=db.scalar(select(AuditLog).where(AuditLog.event_type == "test.event"))
                row.result="denied"
                db.commit()
                assert not verify_chain(db)["valid"]
            assert not c.get("/api/audit/verify", headers=h).json()["valid"]
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
