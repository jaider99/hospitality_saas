from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "STAFF"

class UserInvite(BaseModel):
    """Schema for inviting a new user. No password required — they set it via email link."""
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str = "MANAGER"
    restaurant_id: Optional[int] = None

# Keep UserCreate as alias for backwards compat
UserCreate = UserInvite


class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    supertokens_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name: str
    phone: Optional[str] = None
    role: str
    restaurant_id: Optional[int] = None
    status: str
    invitation_sent_at: Optional[datetime] = None
    invitation_expires_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    permissions: Optional[dict] = None

    class Config:
        from_attributes = True

class UserStatusUpdate(BaseModel):
    status: str


class Token(BaseModel):
    user: UserResponse
    accessToken: str

class PaginatedUsersResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    limit: int
    pages: int

