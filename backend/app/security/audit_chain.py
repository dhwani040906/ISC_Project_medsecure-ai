"""Tamper-evident audit chain for SQLAlchemy-created AuditLog rows.

PostgreSQL advisory transaction lock serializes writers. Chain entries are committed
atomically with their audit logs. This detects alterations; it does not prevent a
privileged DB administrator from rewriting both logs and chain.
"""
import hashlib
import json
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session
from app.models.entities import AuditLog, AuditChainEntry

GENESIS = "0" * 64
LOCK_ID = 82469133

def payload_for(row):
    return json.dumps({
        "id": row.id, "actor_id": row.actor_id,
        "event_type": row.event_type, "result": row.result,
        "record_reference": row.record_reference,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

def hash_entry(previous, payload):
    return hashlib.sha256((previous + "\n" + payload).encode("utf-8")).hexdigest()

@event.listens_for(Session, "before_flush")
def lock_audit_writers(session, flush_context, instances):
    if any(isinstance(obj, AuditLog) for obj in session.new):
        if session.get_bind().dialect.name == "postgresql":
            session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": LOCK_ID})

@event.listens_for(Session, "after_flush")
def append_chain(session, flush_context):
    logs = [obj for obj in session.new if isinstance(obj, AuditLog)]
    if not logs:
        return
    last = session.execute(select(AuditChainEntry.entry_hash).order_by(AuditChainEntry.sequence.desc()).limit(1)).scalar_one_or_none()
    previous = last or GENESIS
    for log in logs:
        payload = payload_for(log)
        entry_hash = hash_entry(previous, payload)
        session.add(AuditChainEntry(audit_id=log.id, payload=payload, previous_hash=previous, entry_hash=entry_hash))
        previous = entry_hash

def verify_chain(session):
    previous = GENESIS
    checked = 0
    rows = session.execute(select(AuditChainEntry).order_by(AuditChainEntry.sequence)).scalars().all()
    for entry in rows:
        if entry.previous_hash != previous or entry.entry_hash != hash_entry(previous, entry.payload):
            return {"valid": False, "checked": checked, "failed_sequence": entry.sequence, "reason": "chain mismatch"}
        original = session.get(AuditLog, entry.audit_id)
        if original is None or payload_for(original) != entry.payload:
            return {"valid": False, "checked": checked, "failed_sequence": entry.sequence, "reason": "audit record changed or missing"}
        previous = entry.entry_hash
        checked += 1
    # Detect unchained audit records, including deleted chain entries.
    audit_count = session.query(AuditLog).count()
    if audit_count != checked:
        return {"valid": False, "checked": checked, "reason": "audit/chain count mismatch", "audit_count": audit_count}
    return {"valid": True, "checked": checked, "head_hash": previous}
