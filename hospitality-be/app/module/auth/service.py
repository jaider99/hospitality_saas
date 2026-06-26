import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import Session, select
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.setting import settings
from app.module.auth.model import User

security = HTTPBearer()

def get_password_hash(password: str) -> str:
    """Hashes a plain text password using bcrypt."""
    salt = bcrypt.gensalt(10)  # Node-compatible salt rounds
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against a bcrypt hashed password."""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieves a user by email address."""
    statement = select(User).where(User.email == email)
    return db.exec(statement).first()

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieves a user by ID."""
    return db.get(User, user_id)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(lambda: next(iter(from_session_import())))
) -> User:
    """
    FastAPI dependency to retrieve the currently authenticated user from JWT.
    Throws 401 UNAUTHORIZED if token is invalid or user does not exist.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        email: str = payload.get("email")
        sub_claim = payload.get("sub")
        if email is None or sub_claim is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = int(sub_claim)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


    
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def from_session_import():
    # Helper to avoid circular imports during dependency resolution
    from app.db.session import get_db
    return get_db()
