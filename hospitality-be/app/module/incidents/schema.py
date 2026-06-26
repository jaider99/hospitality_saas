from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class IncidentCreate(BaseModel):
    type: str  # PRICE_HIKE, LABOR_COST, WASTE
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    message: str

class IncidentResponse(BaseModel):
    id: int
    type: str
    severity: str
    message: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True
