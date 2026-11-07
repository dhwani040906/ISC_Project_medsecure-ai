from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import User, AuditLog, SecurityEvent, LoginAttempt
from app.security.auth import require_roles
from app.security.audit_chain import verify_chain

router = APIRouter(prefix="/audit", tags=["Security audit (admin)"])
Db = Annotated[Session, Depends(get_db)]
Admin = Annotated[User, Depends(require_roles("admin"))]

@router.get("/events")
def events(admin: Admin, db: Db, event_type: str | None = None, result: str | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    stmt = select(AuditLog)
    if event_type:
        stmt = stmt.where(AuditLog.event_type == event_type)
    if result:
        stmt = stmt.where(AuditLog.result == result)
    rows = db.scalars(stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).offset(offset)).all()
    return [{"id": r.id, "created_at": r.created_at, "actor_id": r.actor_id, "event_type": r.event_type, "result": r.result, "record_reference": r.record_reference} for r in rows]

@router.get("/summary")
def summary(admin: Admin, db: Db):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    total = db.scalar(select(func.count(AuditLog.id))) or 0
    denied = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.result == "denied", AuditLog.created_at >= since)) or 0
    failed = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.event_type == "login_failed", AuditLog.created_at >= since)) or 0
    rate_limited = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.event_type == "login_rate_limited", AuditLog.created_at >= since)) or 0
    integrity_failures = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.event_type.in_(["xray.integrity", "report.integrity"]), AuditLog.created_at >= since)) or 0
    alerts = []
    if failed >= 5: alerts.append({"severity": "warning", "kind": "failed_logins", "count": failed})
    if rate_limited: alerts.append({"severity": "warning", "kind": "rate_limited", "count": rate_limited})
    if denied >= 5: alerts.append({"severity": "warning", "kind": "denied_events", "count": denied})
    if integrity_failures: alerts.append({"severity": "critical", "kind": "integrity_failure", "count": integrity_failures})
    return {"total_audit_events": total, "denied_24h": denied, "failed_logins_24h": failed, "rate_limited_24h": rate_limited, "integrity_failures_24h": integrity_failures, "alerts": alerts}

@router.get("/verify")
def verify(admin: Admin, db: Db):
    result = verify_chain(db)
    if not result["valid"]:
        # Never alter the chain as a side effect of verifying it.
        return result
    return result
