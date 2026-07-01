from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from datetime import datetime
from app.db.session import get_db
from app.module.auth.schema import UserRegister, UserLogin, UserResponse, Token
from app.module.auth.model import User, AuditLog
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
    
    from app.module.auth.service import get_user_permissions
    from app.module.auth.schema import UserResponse
    perms = get_user_permissions(db, user)
    user_data = UserResponse.model_validate(user).model_dump()
    user_data["permissions"] = perms
    
    return {
        "user": user_data,
        "accessToken": token
    }

@router.get("/status")
def get_user_status(email: str, db: Session = Depends(get_db)):
    """Retrieves user activation status for checking consumed invite links."""
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {"status": user.status}

@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves current user's profile info based on JWT. Activates profile on successful sign-in."""
    current_user.last_login_at = datetime.utcnow()
    
    # If the user was just invited, transition their status to active and log it
    if current_user.status == "INVITED":
        current_user.status = "ACTIVE"
        
        # Log password configuration and activation event
        pw_log = AuditLog(
            actor_id=current_user.id,
            action="SET_PASSWORD",
            target_user_id=current_user.id,
            details=f"User {current_user.email} completed account setup (set password)."
        )
        db.add(pw_log)

    # Log login event
    login_log = AuditLog(
        actor_id=current_user.id,
        action="LOGIN",
        target_user_id=current_user.id,
        details=f"User {current_user.email} successfully logged in."
    )
    db.add(login_log)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    from app.module.auth.service import get_user_permissions
    from app.module.auth.schema import UserResponse
    perms = get_user_permissions(db, current_user)
    user_data = UserResponse.model_validate(current_user).model_dump()
    user_data["permissions"] = perms
    return user_data
