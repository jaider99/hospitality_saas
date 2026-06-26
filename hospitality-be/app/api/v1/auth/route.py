from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.db.session import get_db
from app.module.auth.schema import UserRegister, UserLogin, UserResponse, Token
from app.module.auth.model import User
from app.module.auth.service import (
    get_user_by_email, 
    get_password_hash, 
    verify_password, 
    create_access_token, 
    get_current_user
)
from app.core.translation import get_lang, translate

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    dto: UserRegister, 
    db: Session = Depends(get_db),
    lang: str = Depends(get_lang)
):
    """Registers a new user, hashes password, and saves to database."""
    existing = get_user_by_email(db, dto.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=translate("email_exists", lang)
        )
        
    hashed_pwd = get_password_hash(dto.password)
    user = User(
        email=dto.email,
        password=hashed_pwd,
        name=dto.name,
        role=dto.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(
    dto: UserLogin, 
    db: Session = Depends(get_db),
    lang: str = Depends(get_lang)
):
    """Authenticates credentials and issues a JWT token."""
    user = get_user_by_email(db, dto.email)
    if not user or not verify_password(dto.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=translate("invalid_credentials", lang)
        )
        
    payload = {"email": user.email, "sub": str(user.id), "role": user.role}
    token = create_access_token(payload)
    
    return {
        "user": user,
        "accessToken": token
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieves current user's profile info based on JWT."""
    return current_user
