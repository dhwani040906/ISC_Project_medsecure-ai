import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.dependencies import get_db
from app.models.entities import User, AuthSession

hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, type=Type.ID)
bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return hasher.hash(password)

def verify_password(password: str, encoded: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except (VerifyMismatchError, VerificationError, ValueError):
        return False

def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def issue_token(db: Session, user: User) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_minutes)
    jti = secrets.token_urlsafe(32)
    payload = {"sub": user.id, "jti": jti, "iss": settings.jwt_issuer, "iat": now, "nbf": now, "exp": exp}
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    db.add(AuthSession(user_id=user.id, token_hash=digest(jti), expires_at=exp))
    db.commit()
    return token, settings.access_token_minutes * 60

def credentials_error():
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication", headers={"WWW-Authenticate": "Bearer"})

def get_auth_context(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)], db: Annotated[Session, Depends(get_db)]) -> tuple[User, AuthSession]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_error()
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"], issuer=settings.jwt_issuer, options={"require": ["exp", "iat", "nbf", "sub", "jti", "iss"]})
        user_id = payload["sub"]
        token_hash = digest(payload["jti"])
    except (jwt.PyJWTError, KeyError, TypeError):
        raise credentials_error()
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash, AuthSession.user_id == user_id))
    user = db.get(User, user_id)
    if not session or session.revoked_at is not None or not user or not user.is_active:
        raise credentials_error()
    exp = session.expires_at
    if exp.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise credentials_error()
    return user, session

def get_current_user(ctx: Annotated[tuple[User, AuthSession], Depends(get_auth_context)]) -> User:
    return ctx[0]

def require_roles(*roles: str):
    def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dependency
