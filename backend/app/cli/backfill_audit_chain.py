"""One-time bootstrap: stop all app writers before running.
Run after Phase 6 migration, before restarting FastAPI.
"""
from sqlalchemy import select, text
from app.db.session import SessionLocal
from app.models.entities import AuditLog, AuditChainEntry
from app.security.audit_chain import GENESIS, LOCK_ID, payload_for, hash_entry, verify_chain

def main():
    with SessionLocal() as db:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": LOCK_ID})
        existing = db.scalar(select(AuditChainEntry.sequence).limit(1))
        if existing is not None:
            print("Chain already initialized; verification:", verify_chain(db))
            return
        previous = GENESIS
        logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at, AuditLog.id)).all()
        for row in logs:
            payload = payload_for(row)
            h = hash_entry(previous, payload)
            db.add(AuditChainEntry(audit_id=row.id, payload=payload, previous_hash=previous, entry_hash=h))
            previous = h
        db.commit()
        print("Backfilled", len(logs), "audit entries. Verification:", verify_chain(db))

if __name__ == "__main__":
    main()
