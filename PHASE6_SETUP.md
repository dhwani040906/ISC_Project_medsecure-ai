# MedSecure AI Phase 6 setup

Merge only the files in this update. Preserve existing `.env`, keys, checkpoints, and Alembic revisions.

1. Stop FastAPI and all processes writing to the database. Back up PostgreSQL first.
2. Activate backend `.venv`. Run `python -m alembic revision --autogenerate -m "phase6 audit chain"`. Review: expected only new `audit_chain_entries` table and indexes.
3. Run `python -m alembic upgrade head`.
4. Run `python -m app.cli.backfill_audit_chain` **once while app is stopped** to chain historical events.
5. Run `python -m alembic check`, then `python -m pytest -q`.
6. Restart FastAPI and React. Log in as admin; click Refresh audit.

## Scope and limitations
- The ORM hook chains all `AuditLog` entries written through SQLAlchemy sessions, including prior auth, image, analysis, and report routes. It does not capture writes made via raw SQL or other tools.
- PostgreSQL advisory locks serialize normal ORM audit writers; direct privileged DB writes can still modify or delete logs.
- SHA-256 hash chaining is **tamper-evident, not tamper-proof**. A privileged actor who can rewrite the database and hashes can forge history. For production, periodically anchor the head hash to an external append-only store.
- Historical audit records are backfilled once; stop writers first.
- Summary alerts are on-demand threshold checks across the last 24 hours, not real-time notifications. Login attempts are not attributed to individual identities in the dashboard.
- Audit metadata may contain sensitive identifiers; restrict database backups and administrator access.
