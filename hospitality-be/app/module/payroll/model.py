from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, date
from typing import Optional, List

class StaffPosition(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(index=True)
    name: str
    color: Optional[str] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class StaffRole(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    position_ids: Optional[str] = Field(default=None) # JSON array of position ids
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class StaffEmployee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(index=True)
    name: str
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    government_id: Optional[str] = Field(default=None)
    weekly_hours: Optional[float] = Field(default=None)
    position_id: Optional[int] = Field(default=None, foreign_key="staffposition.id")
    active: bool = Field(default=True)
    notes: Optional[str] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MonthlyPayroll(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(index=True)
    employee_id: Optional[int] = Field(default=None, foreign_key="staffemployee.id")
    period: str = Field(index=True) # e.g. "2023-08"
    configuration: str = Field(default="company_cost") # "accrued" or "company_cost"
    company_cost: float = Field(default=0.0)
    net_amount: Optional[float] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    attachment_url: Optional[str] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
