from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RestaurantCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_id: Optional[str] = None
    currency: Optional[str] = "EUR"
    timezone: Optional[str] = "UTC"
    operational_status: Optional[str] = "OPEN"
    settings_json: Optional[str] = None

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_id: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    operational_status: Optional[str] = None
    settings_json: Optional[str] = None

class RestaurantResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_id: Optional[str] = None
    currency: str
    timezone: str
    operational_status: str
    settings_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
