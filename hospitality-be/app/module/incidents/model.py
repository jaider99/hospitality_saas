from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional

class OperationalIncident(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: str  # PRICE_HIKE, LABOR_COST, WASTE
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    message: str
    status: str = Field(default="OPEN")  # OPEN, RESOLVED
    created_at: datetime = Field(default_factory=datetime.utcnow)
