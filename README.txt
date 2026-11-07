MedSecure AI — Stage 6B: Account Settings and Password Change

1. BACK UP the listed files in your project before copying replacements.
2. Copy the contents of this ZIP into the medsecure-ai project root, preserving paths.
3. No Alembic migration is required; existing auth_sessions and audit_logs are reused.
4. Start the backend and frontend as usual.
5. Run: cd backend && python -m pytest -x -q
6. Run: cd frontend && npm run build
7. Log in as a patient or doctor, open Settings, and change the password.
8. Verify that you return to sign-in, old password fails, and new password succeeds.
9. Verify the other browser sessions for that account are no longer authorized.

IMPORTANT: This ZIP uses the latest Portal.jsx text provided by the user, and the two uploaded workspace files. If you have made subsequent local changes, merge them rather than overwriting.
This is a development implementation, not a production security certification.
