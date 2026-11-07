# MedSecure AI — Phase 1

A working foundation, **not** a clinical product. No authentication, encryption, AI prediction, or medical record processing is implemented yet.

## Windows setup

1. Create PostgreSQL role and database using pgAdmin or psql:
   ```sql
   CREATE ROLE medsecure_user WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_LOCAL_PASSWORD';
   CREATE DATABASE medsecure_ai OWNER medsecure_user;
   ```
   Run the CREATE DATABASE command outside a transaction. If the role or database exists, reuse it instead of recreating it.
2. In `backend`, copy `.env.example` to `.env` and replace `CHANGE_ME` with your password (URL-encode reserved characters such as @, #, %, /).
3. In `backend`, create and activate Python venv, then `pip install -r requirements.txt`.
4. Run `alembic revision --autogenerate -m "initial schema"` and `alembic upgrade head`.
5. Run `python -m pytest -q` and `uvicorn app.main:app --reload`.
6. In a second terminal, enter `frontend`, run `npm install`, then `npm run dev`.
7. Open http://localhost:5173. API docs: http://localhost:8000/docs.

The DB health endpoint reports only connectivity; it does not prove migrations have run. Verify tables in pgAdmin or with `alembic current`.

## Security
Never commit `.env` or upload real patient records. This is a development-only baseline. Audit log schema is not yet tamper-resistant; this will be implemented in a later phase.
