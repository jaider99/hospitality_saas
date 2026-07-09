from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional
from app.module.restaurant.model import Restaurant

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    supertokens_id: str = Field(unique=True, index=True)
    first_name: Optional[str] = Field(default=None)
    last_name: Optional[str] = Field(default=None)
    name: str = Field(default="")
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = Field(default=None)
    role: str = Field(default="MANAGER")  # SUPER_ADMIN, ADMIN, MANAGER
    restaurant_id: Optional[int] = Field(default=None, foreign_key="restaurant.id")
    status: str = Field(default="ACTIVE")  # ACTIVE, INACTIVE, INVITED
    created_by: Optional[int] = Field(default=None)
    invitation_sent_at: Optional[datetime] = Field(default=None)
    invitation_expires_at: Optional[datetime] = Field(default=None)
    last_login_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    actor_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=True)
    action: str = Field(index=True)  # INVITE, RESEND_INVITE, ACTIVATE, DEACTIVATE, SET_PASSWORD, LOGIN
    target_user_id: int = Field(foreign_key="user.id")
    details: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


from sqlalchemy import UniqueConstraint

class RolePermission(SQLModel, table=True):
    __tablename__ = "app_role_permissions"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "role_name", "module", name="uq_app_role_permission_module"),
    )
    
    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: int = Field(foreign_key="restaurant.id", index=True, ondelete="CASCADE")
    role_name: str = Field(index=True)
    module: str = Field(index=True)
    view: str = Field(default="None")  # None, Own, All
    create: bool = Field(default=False)
    edit: bool = Field(default=False)
    delete: bool = Field(default=False)
    export: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


