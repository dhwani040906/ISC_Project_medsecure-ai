# Phase 2 installation (overlay on completed Phase 1)

**Important:** This ZIP contains a full reference tree based on the Phase 1 ZIP. It does NOT contain your local `.env`, installed `node_modules`, `.venv`, or the initial Alembic migration. Copy only the files listed below into your existing project; do not replace your project directory.

## Copy/replace
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/app/models/entities.py` (append-only changes to original Phase 1 entities)
- `backend/app/db/dependencies.py`
- `backend/app/security/auth.py` and `__init__.py`
- `backend/app/schemas/auth.py` and `__init__.py`
- `backend/app/api/auth.py`
- `backend/app/api/dashboards.py`
- `backend/app/cli/create_admin.py` and `__init__.py`
- `backend/requirements-phase2.txt`
- `backend/tests/test_auth.py`
- `frontend/src/App.jsx`

**Do not overwrite:** `backend/.env`, `frontend/.env`, `backend/alembic/versions/*`, `backend/requirements.txt`, `frontend/package.json`, `frontend/vite.config.js`, or any existing data.

## Backend commands (Windows CMD)
```cmd
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\backend
.venv\Scripts\activate.bat
python -m pip install -r requirements-phase2.txt
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
Copy the generated value to a new line in `backend/.env`:
```dotenv
JWT_SECRET=PASTE_GENERATED_SECRET_HERE
```
Keep your existing `DATABASE_URL` and `FRONTEND_ORIGIN` unchanged.

```cmd
python -m alembic revision --autogenerate -m "phase2 auth sessions and login attempts"
```
**Inspect the generated migration before applying it.** It should add `auth_sessions`, `login_attempts` and their indexes. If it proposes dropping existing tables or columns, STOP and investigate. Then:
```cmd
python -m alembic upgrade head
python -m pytest -q
python -m app.cli.create_admin
python -m uvicorn app.main:app --reload
```
Use a new, unique admin email and a strong password. Do not register an admin through the public registration page.

## Frontend
Keep your `frontend/.env` containing:
```dotenv
VITE_API_URL=http://localhost:8000/api
```
In another terminal:
```cmd
cd C:\Users\dhwan\OneDrive\Desktop\isc_project\medsecure-ai\frontend
npm run dev
```
Open http://localhost:5173. Register a patient; sign in; test logout. Sign in as admin; create a doctor; sign in as doctor.

## Notes
- Access tokens are stored in React component memory and lost on refresh.
- Login throttling uses PostgreSQL, with five failed attempts per email in a rolling 15-minute window. This is an academic baseline, not a full IP-based or distributed abuse-prevention solution.
- This is not ready for production medical data. HTTPS, stronger operational controls, password reset, verified email, patient-doctor grants and comprehensive audit hardening remain future work.
