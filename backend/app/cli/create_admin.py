import getpass
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.session import engine
from app.models.entities import User
from app.security.auth import hash_password

def main():
    email = input("Admin email: ").strip().lower()
    if "@" not in email or len(email) > 320:
        raise SystemExit("Invalid email")
    password = getpass.getpass("Admin password (min 12 characters): ")
    confirm = getpass.getpass("Confirm password: ")
    if len(password) < 12 or len(password) > 128 or password != confirm:
        raise SystemExit("Password mismatch or invalid length")
    with Session(engine) as db:
        if db.scalar(select(User.id).where(func.lower(User.email) == email)):
            raise SystemExit("Email already exists; no changes made")
        db.add(User(email=email, password_hash=hash_password(password), role="admin"))
        db.commit()
    print("Admin created successfully")

if __name__ == "__main__":
    main()
