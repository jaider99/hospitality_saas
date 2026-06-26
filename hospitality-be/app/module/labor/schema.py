from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class StaffCreate(BaseModel):
    name: str
    role: str  # CHEF, WAITER, MANAGER, HOST
    hourlyRate: float = Field(alias="hourlyRate")

    class Config:
        populate_by_name = True

class ClockInRequest(BaseModel):
    staffId: int

class ClockOutRequest(BaseModel):
    staffId: int

class LaborAuditRequest(BaseModel):
    estimatedSales: Optional[float] = Field(default=1000.0, alias="estimatedSales")

    class Config:
        populate_by_name = True

class StaffResponse(BaseModel):
    id: int
    name: str
    role: str
    hourlyRate: float
    shiftsCount: int

    class Config:
        from_attributes = True

class ShiftResponse(BaseModel):
    id: int
    staffId: int
    clockIn: datetime
    clockOut: Optional[datetime]
    totalHours: Optional[float]
    totalPay: Optional[float]
    staff: Optional[StaffResponse]

    class Config:
        from_attributes = True
        populate_by_name = True
