# Phase 3 — encrypted image storage

## Merge
Copy only the files in this update into your existing project, preserving `backend/.env`, `frontend/.env`, migrations, and requirements files. Do not replace the database.

## Backend (CMD)
```cmd
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\backend
.venv\Scripts\activate.bat
python -m pip install -r requirements-phase3.txt
python -m app.cli.create_image_keys
python -m alembic revision --autogenerate -m "phase3 image encryption"
```
**Inspect the generated revision.** Phase 3 uses existing `xray_records`, `encryption_metadata`, `patient_doctor_permissions`, and `audit_logs` tables, so the generated migration should contain **no table changes**. If it contains unexpected operations, stop. If it is empty, you may discard the empty revision; no database migration is required.

Then run:
```cmd
python -m uvicorn app.main:app --reload
```

## Frontend
```cmd
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\frontend
npm run dev
```

## Test
```cmd
python -m pytest -q
```
Use a **synthetic** PNG/JPEG file, log in as a patient, upload and download it, and compare its SHA-256 to the original. Grant doctor access via the patient interface, log in as that doctor and verify access. Test that another doctor and admin cannot download it. For revocation use `DELETE /api/images/permissions/{doctor_id}` in Swagger with the patient bearer token.

## Key management
Private key location defaults to `../storage/keys/image_wrapping_private.pem` relative to backend working directory. Keep it out of Git, back it up securely, restrict file permissions and do not overwrite it. If lost, existing encrypted images cannot be recovered. For production use a managed KMS/HSM, TLS, encrypted backups, stronger operational audit controls and clinical privacy review. The demo does not establish HIPAA/GDPR compliance.
