# MedSecure AI — Patient and Doctor Identity Update

## Safety
Back up the `medsecure_ai_v2` database and your current source files first. Preserve `.env`, keys, models, report ciphertext, audit-chain data and Alembic history. This update is for your existing local development application; do not publish medical identity data.

## Database
With FastAPI stopped, run the SQL in `backend/phase_identity_migration.sql` **against medsecure_ai_v2 only** using pgAdmin Query Tool. This creates nullable `users.full_name` and `users.username` fields and a unique username index. Existing accounts remain intact. Do not run Alembic autogenerate blindly: the database has a manual schema addition. To keep Alembic migration history authoritative, convert the SQL statements into a new Alembic revision instead of running the SQL directly; use only one method.

## Source merge
Copy the update files to the same paths in your project, replacing the listed files only. `backend/app/api/images.py` contains the Phase 3 `db.flush()` FK fix; compare it with your local file before replacing if you have made further edits. `backend/app/models/entities.py` is based on the Phase 6 model and includes `AuditChainEntry`. Preserve your Phase 7 `main.py` security middleware; this update does not overwrite `main.py`.

## Existing users
Existing patients and doctors can sign in and complete **My profile** with full name and username. New patient registrations and admin-created doctor accounts require both fields in the React UI. Login continues to use email/password. Names are not stored in audit events.

## Reports
Only newly generated reports include names, usernames and readable XR/RPT/AI references. The patient's identity comes from the X-ray's owner, never the logged-in doctor's identity. If a doctor generates the report, it also states the requesting doctor's name/username, not a clinical endorsement. Existing encrypted/signed PDFs are unchanged; do not edit them or they will fail signature verification. No sequential database IDs are introduced; display references use a 12-character UUID-derived suffix.

## Commands
```
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\backend
.venv\Scripts\activate.bat
python -m pytest -q
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Frontend: `cd ..\frontend && npm run build && npm run dev`.

## Manual checks
1. Existing patient signs in, saves name and username, uploads an X-ray, analyzes and creates a NEW PDF.
2. Doctor signs in, saves profile; with patient-granted access, sees the patient's name on the X-ray and creates a report with both identities.
3. Patient revokes access; doctor loses X-ray/report access.
4. Verify new PDF signature, download; verify an older PDF is unchanged.
5. Check admin audit integrity after profile updates; run all tests.

**Privacy:** Real patient names in encrypted reports increase the sensitivity of exported PDFs. Share only with authorized recipients. For research, prefer synthetic identities.
