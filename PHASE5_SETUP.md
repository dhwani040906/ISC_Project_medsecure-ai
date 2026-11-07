# MedSecure AI Phase 5 — signed, encrypted research reports

This ZIP is a merge-only patch for the **existing** Phase 1–4 installation. It does not contain `.env`, migration history, existing RSA keys, or model weights. Keep the user's corrected `backend/app/api/images.py` (Phase 4 foreign-key flush fix) unchanged.

## Scope

- PDF generated in memory using ReportLab from an existing authorized prediction.
- PDF signed with **detached** RSA-PSS/SHA-256 signature, stored in `digital_signatures`. This is **not** an embedded Adobe/PAdES PDF signature; opening the PDF in Acrobat will not show an embedded certificate signature.
- PDF encrypted at rest with AES-256-GCM, per-report random key wrapped by the **existing Phase 3 image-wrapping RSA key** (RSA-OAEP/SHA-256). The report ID is authenticated associated data. Encrypted ciphertext only is written to `storage/reports/<uuid>.enc`.
- New `report_encryption_metadata` table stores wrapped AES key and nonce. Existing `medical_reports`, `digital_signatures`, `predictions`, and `audit_logs` are reused.
- Patient owners and currently authorized doctors can generate, list, verify, and download; administrators cannot access reports by default. Revoking doctor access blocks future retrieval.
- SHA-256 digest and RSA-PSS signature are checked before every download. Verification returns `verified: false` on tampering; download returns HTTP 409.
- This is a research-only report, not a diagnosis.

## Install (CMD)

```cmd
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\backend
.venv\Scripts\activate.bat
python -m pip install -r requirements-phase5.txt
```

## Generate a dedicated report signing key pair (once only)

```cmd
python -m app.cli.create_report_keys
```

The command refuses to overwrite existing keys. Keep both keys under `storage/keys`, never commit them to Git. The private key is unencrypted for local development and must be protected using OS permissions; use a managed key service for production. **Do not regenerate or delete the existing image-wrapping RSA keys** because report decryption depends on them.

## Alembic migration (new table)

```cmd
python -m alembic current
python -m alembic revision --autogenerate -m "phase5 report encryption metadata"
```

**Inspect the generated file** before applying. It should create only `report_encryption_metadata` and its foreign-key/unique constraints. If it proposes drops or unrelated modifications, stop and resolve them before proceeding. Then:

```cmd
python -m alembic upgrade head
python -m alembic check
```

## Start backend / frontend

```cmd
python -m uvicorn app.main:app --reload
```

Second terminal:

```cmd
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\frontend
npm run dev
```

Log in as patient, upload a synthetic test image, click `Analyze (research)`, then click `Reports` beside the image. Select `Generate signed PDF report`, `Verify signature`, and `Download PDF`. The report's research-only disclaimer should be visible in the PDF.

## API endpoints

- `POST /api/reports/predictions/{prediction_id}` — generate and encrypt signed PDF; returns report ID
- `GET /api/reports/predictions/{prediction_id}` — list reports for prediction
- `GET /api/reports/{report_id}/verify` — verify integrity and signature
- `GET /api/reports/{report_id}/download` — verified PDF bytes, no-store

## Tests

```cmd
python -m pytest -q
```

Reference merged suite: **7 passed** in an isolated SQLite test environment. This is not a guarantee about your local PostgreSQL configuration. Test unauthorized admin/doctor access, doctor grant/revocation, signature tampering, ciphertext tampering, and re-download. The new test covers unauthorized admin/doctor access, ciphertext and signature tampering, and successful PDF download.

## Caveats

- The detached signature is verifiable through the application, not through a PDF viewer's built-in digital-signature interface.
- Key rotation, protected backups, private-key encryption, certificate-chain identity, trusted timestamps, patient-level audit review, and external security assessment are not implemented.
- Filesystem and DB commits cannot be fully atomic; the implementation cleans up on DB failure but does not include a crash-recovery reconciliation job.
- The ML output is not clinically validated; reports must never guide diagnosis or treatment.
- Use synthetic/non-sensitive images for development.
