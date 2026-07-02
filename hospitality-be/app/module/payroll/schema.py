from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class StaffPositionBase(BaseModel):
    name: str
    color: Optional[str] = None

class StaffPositionCreate(StaffPositionBase):
    pass

class StaffPositionUpdate(StaffPositionBase):
    name: Optional[str] = None

class StaffPositionRead(StaffPositionBase):
    id: int
    property_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StaffEmployeeBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    government_id: Optional[str] = None
    weekly_hours: Optional[float] = None
    position_id: Optional[int] = None
    active: bool = True
    notes: Optional[str] = None

class StaffEmployeeCreate(StaffEmployeeBase):
    pass

class StaffEmployeeUpdate(StaffEmployeeBase):
    name: Optional[str] = None
    active: Optional[bool] = None

class StaffEmployeeRead(StaffEmployeeBase):
    id: int
    property_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MonthlyPayrollBase(BaseModel):
    employee_id: Optional[int] = None
    period: str
    configuration: str = "company_cost"
    company_cost: float = 0.0
    net_amount: Optional[float] = None
    notes: Optional[str] = None

class MonthlyPayrollCreate(MonthlyPayrollBase):
    pass

class MonthlyPayrollUpdate(MonthlyPayrollBase):
    period: Optional[str] = None
    configuration: Optional[str] = None
    company_cost: Optional[float] = None

class MonthlyPayrollRead(MonthlyPayrollBase):
    id: int
    property_id: int
    attachment_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MonthlyPayrollDuplicate(BaseModel):
    source_period: str
    target_period: str
    copy_notes: bool = False
    copy_attachments: bool = False
