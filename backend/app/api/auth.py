import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.dependencies import get_db
from app.models.entities import User, Patient, Doctor, AuditLog, AuthSession, LoginAttempt
from app.schemas.auth import RegisterRequest, LoginRequest, DoctorCreateRequest, UserOut, TokenResponse, ProfileUpdateRequest, PasswordChangeRequest
from app.security.auth import hash_password, verify_password, issue_token, digest, get_current_user, get_auth_context, require_roles

router = APIRouter(prefix="/auth", tags=["Authentication"])
Db = Annotated[Session, Depends(get_db)]

# Normalize before lookup and hashing to avoid case-dependent identities.
def normalized_email(email: str) -> str:
    return email.strip().lower()

def log(db: Session, actor: str | None, event: str, result: str):
    db.add(AuditLog(actor_id=actor, event_type=event, result=result))

def clean_identity(full_name, username):
    name = " ".join(full_name.split()) if full_name else None
    handle = username.strip().lower() if username else None
    if name is not None and len(name) < 2:
        raise HTTPException(422, "Full name must contain at least two characters")
    return name, handle

def username_available(db, username, exclude_id=None):
    if username and db.scalar(select(User.id).where(func.lower(User.username) == username, User.id != exclude_id)):
        raise HTTPException(409, "Username already in use")

def password_policy(password: str):
    if len(password.encode("utf-8")) > 1024:
        raise HTTPException(422, "Password too long")

@router.post("/register", response_model=UserOut, status_code=201)
def register(data: RegisterRequest, db: Db):
    password_policy(data.password)
    email = normalized_email(str(data.email))
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(409, "Email already registered")
    name, handle = clean_identity(data.full_name, data.username)
    username_available(db, handle)
    user = User(email=email, password_hash=hash_password(data.password), role="patient", full_name=name, username=handle)
    db.add(user)
    db.flush()
    db.add(Patient(user_id=user.id, pseudonym="PAT-" + secrets.token_hex(8).upper()))
    log(db, user.id, "patient_registration", "success")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")
    db.refresh(user)
    return user

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Db):
    email = normalized_email(str(data.email))
    key = digest(email)
    now = datetime.now(timezone.utc)
    window = now - timedelta(minutes=15)
    # Retain only the current lockout window for this identity.
    db.execute(delete(LoginAttempt).where(LoginAttempt.identifier_hash == key, LoginAttempt.attempted_at < window))
    failures = db.scalar(select(func.count(LoginAttempt.id)).where(LoginAttempt.identifier_hash == key)) or 0
    if failures >= 5:
        log(db, None, "login_rate_limited", "denied")
        db.commit()
        raise HTTPException(429, "Too many attempts. Try again after 15 minutes.", headers={"Retry-After": "900"})
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not user or not verify_password(data.password, user.password_hash) or not user.is_active:
        db.add(LoginAttempt(identifier_hash=key, attempted_at=now))
        log(db, None, "login_failed", "denied")
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    db.execute(delete(LoginAttempt).where(LoginAttempt.identifier_hash == key))
    if user.password_hash and __import__("app.security.auth", fromlist=["hasher"]).hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
    log(db, user.id, "login_success", "success")
    db.commit()
    token, expires_in = issue_token(db, user)
    return TokenResponse(access_token=token, expires_in=expires_in, user=user)

@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user

@router.post("/logout", status_code=204)
def logout(ctx: Annotated[tuple[User, AuthSession], Depends(get_auth_context)], db: Db):
    user, session = ctx
    session.revoked_at = datetime.now(timezone.utc)
    log(db, user.id, "logout", "success")
    db.commit()

@router.post("/doctors", response_model=UserOut, status_code=201)
def create_doctor(data: DoctorCreateRequest, db: Db, admin: Annotated[User, Depends(require_roles("admin"))]):
    password_policy(data.password)
    email = normalized_email(str(data.email))
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(409, "Email already registered")
    name, handle = clean_identity(data.full_name, data.username)
    username_available(db, handle)
    doctor = User(email=email, password_hash=hash_password(data.password), role="doctor", full_name=name, username=handle)
    db.add(doctor)
    db.flush()
    db.add(Doctor(user_id=doctor.id, license_reference=data.license_reference))
    log(db, admin.id, "doctor_created", "success")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")
    db.refresh(doctor)
    return doctor

@router.patch("/me/profile", response_model=UserOut)
def update_profile(data: ProfileUpdateRequest, db: Db, user: Annotated[User, Depends(get_current_user)]):
    if user.role not in ("patient", "doctor"):
        raise HTTPException(403, "Profile updates are limited to patient and doctor accounts")
    name, handle = clean_identity(data.full_name, data.username)
    username_available(db, handle, user.id)
    user.full_name = name
    user.username = handle
    log(db, user.id, "profile.updated", "success")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Username already in use")
    db.refresh(user)
    return user

@router.patch("/me/password", status_code=204)
def change_password(
    data: PasswordChangeRequest,
    db: Db,
    ctx: Annotated[tuple[User, AuthSession], Depends(get_auth_context)],
):
    user, _ = ctx
    password_policy(data.new_password)
    if not verify_password(data.current_password, user.password_hash):
        log(db, user.id, "password.change_failed", "denied")
        db.commit()
        raise HTTPException(400, "Current password is incorrect")
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(422, "New password must differ from current password")
    user.password_hash = hash_password(data.new_password)
    now = datetime.now(timezone.utc)
    sessions = db.scalars(select(AuthSession).where(
        AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None)
    )).all()
    for session in sessions:
        session.revoked_at = now
    log(db, user.id, "password.changed", "success")
    db.commit()
