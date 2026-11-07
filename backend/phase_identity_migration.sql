-- Run once on medsecure_ai_v2 after backing up. Compatible with existing records.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);
COMMIT;
