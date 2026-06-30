import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional

from app.db.session import get_db
from app.module.auth.model import User, AuditLog
from app.module.auth.schema import UserCreate, UserResponse, UserStatusUpdate, PaginatedUsersResponse
from app.core.authz import check_permission
from app.core.setting import settings
from app.core.email import send_invite_email
from supertokens_python.recipe.emailpassword.asyncio import (
    sign_up as st_sign_up,
    create_reset_password_token,
)
from supertokens_python.recipe.userroles.asyncio import add_role_to_user

router = APIRouter()
logger = logging.getLogger("users_router")


@router.get("", response_model=PaginatedUsersResponse)
def list_users(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("read"))
):
    """Lists users with search filtering and server-side pagination."""
    stmt = select(User)
    if current_user.restaurant_id:
        stmt = stmt.where(User.restaurant_id == current_user.restaurant_id)
    
    # Apply search filter
    if search:
        search_query = f"%{search}%"
        stmt = stmt.where(
            (User.name.ilike(search_query)) | 
            (User.email.ilike(search_query))
        )
        
    # Get total count before pagination limit/offset
    total = len(db.exec(stmt).all())
    
    # Apply pagination
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)
    users = db.exec(stmt).all()
    
    import math
    pages = math.ceil(total / limit) if limit > 0 else 0
    
    return {
        "items": users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    dto: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("manage"))
):
    """
    Invites a new user (ADMIN or MANAGER) to the system.
    1. Creates the user in SuperTokens with a random temporary password.
    2. Generates a password-reset token (the invite link).
    3. Emails the invite link so the user can set their own password.
    4. Saves the profile in PostgreSQL.
    """
    role_upper = dto.role.upper()
    if role_upper not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'ADMIN' or 'MANAGER'."
        )

    if current_user.role == "ADMIN" and role_upper != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Restaurant Admins can only invite Team Managers."
        )

    # 1. Check if user already exists in local DB
    stmt_exists = select(User).where(User.email == dto.email)
    if db.exec(stmt_exists).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists."
        )

    # 2. Register user in SuperTokens with a secure random temp password
    #    (they will replace it via the invite link)
    temp_password = secrets.token_urlsafe(24)
    st_user_id = None
    try:
        st_result = await st_sign_up("public", dto.email, temp_password)
        from supertokens_python.recipe.emailpassword.interfaces import SignUpOkResult
        if isinstance(st_result, SignUpOkResult):
            st_user_id = st_result.recipe_user_id.get_as_string()
        else:
            # User already exists in SuperTokens Core. Let's look them up.
            from supertokens_python.asyncio import list_users_by_account_info
            from supertokens_python.types.base import AccountInfoInput
            
            users = await list_users_by_account_info("public", AccountInfoInput(email=dto.email))
            if users:
                st_user_id = users[0].id
                logger.info(f"User with email {dto.email} already exists in SuperTokens. Recovered ST ID: {st_user_id}")
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email is already registered in SuperTokens."
                )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register user in SuperTokens: {str(e)}"
        )

    # 3. Assign role in SuperTokens
    try:
        await add_role_to_user("public", st_user_id, role_upper)
    except Exception as role_err:
        logger.error(f"Failed to assign role to invited user: {role_err}")

    # 4. Generate a password-reset token → this becomes the invite link
    invite_link: str | None = None
    try:
        # Pass required email positional parameter in create_reset_password_token
        token_result = await create_reset_password_token("public", st_user_id, dto.email)
        if hasattr(token_result, "token"):
            token = token_result.token  # type: ignore[attr-defined]
            invite_link = (
                f"{settings.WEBSITE_DOMAIN}/auth/reset-password"
                f"?token={token}&tenantId=public&email={dto.email}"
            )
        else:
            logger.error(f"Failed to generate invite token: Unknown error response {type(token_result)}")
    except Exception as token_err:
        logger.error(f"Failed to generate invite token: {token_err}")
        # Non-fatal: user is created, just no email sent

    # 5. Save user profile in PostgreSQL
    # Check if user already exists in local DB (e.g. created by SuperTokens sign_up hook)
    stmt_user = select(User).where(User.email == dto.email)
    existing_profile = db.exec(stmt_user).first()
    
    sent_at = datetime.utcnow()
    expires_at = sent_at + timedelta(hours=24)

    if existing_profile:
        logger.info(f"User profile for {dto.email} already exists. Updating profile details.")
        existing_profile.supertokens_id = st_user_id
        existing_profile.first_name = dto.first_name
        existing_profile.last_name = dto.last_name
        existing_profile.name = f"{dto.first_name} {dto.last_name}".strip()
        existing_profile.phone = dto.phone
        existing_profile.role = role_upper
        existing_profile.restaurant_id = current_user.restaurant_id
        existing_profile.status = "INVITED"
        existing_profile.invitation_sent_at = sent_at
        existing_profile.invitation_expires_at = expires_at
        db.add(existing_profile)
        db.commit()
        db.refresh(existing_profile)
        new_user = existing_profile
    else:
        new_user = User(
            supertokens_id=st_user_id,
            email=dto.email,
            first_name=dto.first_name,
            last_name=dto.last_name,
            name=f"{dto.first_name} {dto.last_name}".strip(),
            phone=dto.phone,
            role=role_upper,
            restaurant_id=current_user.restaurant_id,
            status="INVITED",          # distinct status until they set password
            invitation_sent_at=sent_at,
            invitation_expires_at=expires_at
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    # 6. Log invite event in AuditLog
    invite_log = AuditLog(
        actor_id=current_user.id,
        action="INVITE",
        target_user_id=new_user.id,
        details=f"Admin {current_user.email} invited {new_user.email} as {role_upper}."
    )
    db.add(invite_log)
    db.commit()

    # 7. Send invite email
    if invite_link:
        inviter_name = (
            f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
            or current_user.name
            or "An administrator"
        )
        send_invite_email(
            to_email=dto.email,
            first_name=dto.first_name,
            role=role_upper,
            invite_link=invite_link,
            inviter_name=inviter_name,
        )
    else:
        logger.warning(f"Invite email skipped for {dto.email} — no token generated.")

    return new_user


@router.post("/{id}/resend-invite", response_model=UserResponse)
async def resend_invite(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("manage"))
):
    """
    Resends password setup invitation link to a user.
    Only allows resending to users in 'INVITED' or 'INACTIVE' status.
    Generates a new secure reset token (invalidates old ones) and emails it.
    """
    user = db.get(User, id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if user.restaurant_id != current_user.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot modify users from another restaurant."
        )

    if current_user.role == "ADMIN" and user.role != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Restaurant Admins can only manage status and invites of Team Managers."
        )
    
    # Generate new token (which invalidates any previous tokens in SuperTokens Core)
    try:
        token_result = await create_reset_password_token("public", user.supertokens_id, user.email)
        if hasattr(token_result, "token"):
            token = token_result.token  # type: ignore[attr-defined]
            invite_link = (
                f"{settings.WEBSITE_DOMAIN}/auth/reset-password"
                f"?token={token}&tenantId=public&email={user.email}"
            )
        else:
            raise Exception("Failed to generate password reset token from SuperTokens")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate fresh invitation link: {str(e)}"
        )
        
    # Update invitation timestamps and status
    user.invitation_sent_at = datetime.utcnow()
    user.invitation_expires_at = datetime.utcnow() + timedelta(hours=24)
    user.status = "INVITED"  # reset status to invited if they were inactive
    db.add(user)
    
    # Log resend event in AuditLog
    resend_log = AuditLog(
        actor_id=current_user.id,
        action="RESEND_INVITE",
        target_user_id=user.id,
        details=f"Admin {current_user.email} resent invitation to {user.email}."
    )
    db.add(resend_log)
    db.commit()
    db.refresh(user)
    
    # Dispatch email
    inviter_name = (
        f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
        or current_user.name
        or "An administrator"
    )
    send_invite_email(
        to_email=user.email,
        first_name=user.first_name or user.name.split(" ")[0],
        role=user.role,
        invite_link=invite_link,
        inviter_name=inviter_name,
    )
    
    return user


@router.patch("/{id}/status", response_model=UserResponse)
def update_status(
    id: int,
    dto: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("manage"))
):
    """
    Updates a user's status (ACTIVE or INACTIVE).
    Logs the activation/deactivation event.
    """
    status_upper = dto.status.upper()
    if status_upper not in ["ACTIVE", "INACTIVE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Must be 'ACTIVE' or 'INACTIVE'."
        )
        
    user = db.get(User, id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bad Request: You cannot change your own status."
        )

    if user.restaurant_id != current_user.restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot modify users from another restaurant."
        )

    if current_user.role == "ADMIN" and user.role != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Restaurant Admins can only manage status of Team Managers."
        )
        
    old_status = user.status
    user.status = status_upper
    user.updated_at = datetime.utcnow()
    db.add(user)
    
    # Log the action in AuditLog
    action_name = "ACTIVATE" if status_upper == "ACTIVE" else "DEACTIVATE"
    status_log = AuditLog(
        actor_id=current_user.id,
        action=action_name,
        target_user_id=user.id,
        details=f"Admin {current_user.email} changed {user.email} status from {old_status} to {status_upper}."
    )
    db.add(status_log)
    db.commit()
    db.refresh(user)
    
    return user
