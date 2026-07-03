from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class SupplierContactBase(BaseModel):
    name: str
    position: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_preference: Optional[str] = None
    is_main_contact: bool = False

class SupplierContactCreate(SupplierContactBase):
    pass

class SupplierContactRead(SupplierContactBase):
    id: int
    supplier_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class SupplierBase(BaseModel):
    name: str
    supplier_code: Optional[str] = None
    legal_name: Optional[str] = None
    vat_id: Optional[str] = None
    address: Optional[str] = None
    category_id: Optional[str] = None
    accounting_account: Optional[str] = None
    sanitary_registration: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    payment_info: Optional[Dict[str, Any]] = None
    notes: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class SupplierCreate(SupplierBase):
    contacts: List[SupplierContactCreate] = Field(default_factory=list)

class SupplierContactUpdate(SupplierContactBase):
    id: Optional[int] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    vat_id: Optional[str] = None
    address: Optional[str] = None
    category_id: Optional[str] = None
    accounting_account: Optional[str] = None
    sanitary_registration: Optional[str] = None
    tags: Optional[List[str]] = None
    payment_info: Optional[Dict[str, Any]] = None
    contacts: Optional[List[SupplierContactUpdate]] = None
    notes: Optional[List[Dict[str, Any]]] = None

class SupplierRead(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime
    contact_list: List[SupplierContactRead] = Field(default_factory=list)

    class Config:
        orm_mode = True
