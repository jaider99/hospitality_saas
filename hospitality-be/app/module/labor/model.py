from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List

class StaffMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: str  # CHEF, WAITER, MANAGER, HOST
    hourly_rate: float = Field(default=0.0, schema_extra={"name": "hourlyRate"})
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    shifts: List["StaffShift"] = Relationship(back_populates="staff", cascade_delete=True)

class StaffShift(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: int = Field(foreign_key="staffmember.id", ondelete="CASCADE")
    clock_in: datetime = Field(default_factory=datetime.utcnow)
    clock_out: Optional[datetime] = Field(default=None)
    total_hours: Optional[float] = Field(default=None)
    total_pay: Optional[float] = Field(default=None)

    # Relationships
    staff: StaffMember = Relationship(back_populates="shifts")
