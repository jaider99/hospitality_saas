from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional

class Restaurant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    address: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    tax_id: Optional[str] = Field(default=None)
    currency: str = Field(default="EUR")
    timezone: str = Field(default="UTC")
    operational_status: str = Field(default="OPEN") # OPEN, CLOSED, MAINTENANCE
    settings_json: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
