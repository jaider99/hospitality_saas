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

from supertokens_python.recipe.session.framework.fastapi import verify_session
from supertokens_python.recipe.session import SessionContainer
from app.db.session import get_db

async def get_current_user(
    session: SessionContainer = Depends(verify_session()),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to retrieve the currently authenticated user from SuperTokens Session.
    Throws 401 UNAUTHORIZED if session is invalid or user does not exist in local DB.
    """
    st_user_id = session.get_user_id()
    try:
        from sqlmodel import select
        statement = select(User).where(User.supertokens_id == st_user_id)
        user = db.exec(statement).first()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query error during auth: {str(e)}"
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in application database",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


ALL_MODULES = [
    "restaurant_settings",
    "dashboard",
    "documents",
    "suppliers",
    "products",
    "recipes",
    "staff_costs",
    "sales",
    "incidents",
    "reconciliation",
    "purchases",
    "inventory",
    "treasury",
    "staff_management"
]

DEFAULT_ROLE_PERMISSIONS = {
    "Administrator": {
        m: {"view": "All", "create": True, "edit": True, "delete": True, "export": True}
        for m in ALL_MODULES
    },
    "Document Management": {
        "restaurant_settings": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "dashboard": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "documents": {"view": "All", "create": True, "edit": True, "delete": True, "export": True},
        "suppliers": {"view": "All", "create": True, "edit": True, "delete": True, "export": True},
        "products": {"view": "All", "create": True, "edit": True, "delete": True, "export": True},
        "recipes": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "staff_costs": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "sales": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "incidents": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "reconciliation": {"view": "All", "create": True, "edit": True, "delete": True, "export": True},
        "purchases": {"view": "All", "create": True, "edit": True, "delete": True, "export": True},
        "inventory": {"view": "All", "create": True, "edit": True, "delete": True, "export": True},
        "treasury": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "staff_management": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
    },
    "Chef & Kitchen": {
        "restaurant_settings": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "dashboard": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "documents": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "suppliers": {"view": "All", "create": False, "edit": False, "delete": False, "export": False},
        "products": {"view": "All", "create": True, "edit": True, "delete": False, "export": False},
        "recipes": {"view": "All", "create": True, "edit": True, "delete": False, "export": False},
        "staff_costs": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "sales": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "incidents": {"view": "All", "create": True, "edit": False, "delete": False, "export": False},
        "reconciliation": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "purchases": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "inventory": {"view": "All", "create": True, "edit": True, "delete": False, "export": False},
        "treasury": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
        "staff_management": {"view": "None", "create": False, "edit": False, "delete": False, "export": False},
    },
    "Management View": {
        m: {"view": "All", "create": False, "edit": False, "delete": False, "export": False}
        for m in ALL_MODULES
    }
}

def seed_default_permissions_for_restaurant(db: Session, restaurant_id: int):
    """Seeds the default permissions for the 4 system predefined roles if not present."""
    from app.module.auth.model import RolePermission
    for role_name, modules in DEFAULT_ROLE_PERMISSIONS.items():
        for module, perms in modules.items():
            existing = db.exec(
                select(RolePermission).where(
                    RolePermission.restaurant_id == restaurant_id,
                    RolePermission.role_name == role_name,
                    RolePermission.module == module
                )
            ).first()
            if not existing:
                rp = RolePermission(
                    restaurant_id=restaurant_id,
                    role_name=role_name,
                    module=module,
                    view=perms["view"],
                    create=perms["create"],
                    edit=perms["edit"],
                    delete=perms["delete"],
                    export=perms["export"]
                )
                db.add(rp)
            else:
                # Self-healing check: if the default system role settings have changed, update them.
                # Specifically update 'Document Management' role's view on 'restaurant_settings' from 'None' to 'All'
                if role_name == "Document Management" and module == "restaurant_settings" and existing.view == "None":
                    existing.view = perms["view"]
                    db.add(existing)
    db.commit()

def get_user_permissions(db: Session, user: User) -> dict:
    """Returns a dictionary mapping module -> action permissions for the user."""
    from app.module.auth.model import RolePermission

    # SUPER_ADMIN gets All access to everything
    if user.role == "SUPER_ADMIN":
        return {
            m: {"view": "All", "create": True, "edit": True, "delete": True, "export": True}
            for m in ALL_MODULES
        }
    
    # If the user has no restaurant_id, they can't have custom role permissions
    if not user.restaurant_id:
        # Fallback to empty permissions
        return {
            m: {"view": "None", "create": False, "edit": False, "delete": False, "export": False}
            for m in ALL_MODULES
        }

    # Ensure defaults are seeded for this restaurant
    seed_default_permissions_for_restaurant(db, user.restaurant_id)

    # Fetch from database
    stmt = select(RolePermission).where(
        RolePermission.restaurant_id == user.restaurant_id,
        RolePermission.role_name == user.role
    )
    records = db.exec(stmt).all()

    permissions_map = {}
    for r in records:
        permissions_map[r.module] = {
            "view": r.view,
            "create": r.create,
            "edit": r.edit,
            "delete": r.delete,
            "export": r.export
        }

    # Fill in any missing modules with None access
    for m in ALL_MODULES:
        if m not in permissions_map:
            # Fallback to the role default if defined, otherwise None
            role_defaults = DEFAULT_ROLE_PERMISSIONS.get(user.role, {})
            permissions_map[m] = role_defaults.get(
                m, 
                {"view": "None", "create": False, "edit": False, "delete": False, "export": False}
            )

    return permissions_map

