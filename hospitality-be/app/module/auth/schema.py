from pydantic import BaseModel, EmailStr
from typing import Optional

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "STAFF"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    user: UserResponse
    accessToken: str
