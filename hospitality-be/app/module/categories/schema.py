from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#000000"
    parent_category_id: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    parent_category_id: Optional[str] = None

class CategoryRead(CategoryBase):
    id: int
    category_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
