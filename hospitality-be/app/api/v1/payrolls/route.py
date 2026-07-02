from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlmodel import Session
from typing import List, Optional
import uuid

from app.db.session import get_db
# Assuming we have a dependency to get property_id, typical for this app
# Let's import the one used in other modules. e.g. from app.api.dependencies import get_current_property_id
# I will use a placeholder or see how invoices get it. Let's use `property_id: int` query parameter as user asked in question 5 if it should be query param. "property id is resturant id" - yes.
from app.module.payroll.schema import (
    StaffPositionCreate, StaffPositionRead,
    StaffEmployeeCreate, StaffEmployeeRead, StaffEmployeeUpdate,
    MonthlyPayrollCreate, MonthlyPayrollRead, MonthlyPayrollUpdate, MonthlyPayrollDuplicate
)
from app.module.payroll.service import (
    get_positions, create_position,
    get_employees, create_employee, update_employee,
    get_payrolls, create_payroll, update_payroll, delete_payroll, duplicate_payrolls
)
from app.core.minio import upload_to_minio
router = APIRouter(tags=["Payrolls"])
@router.get("/positions", response_model=List[StaffPositionRead])
def api_get_positions(property_id: int, session: Session = Depends(get_db)):
    return get_positions(session, property_id)

@router.post("/positions", response_model=StaffPositionRead)
def api_create_position(property_id: int, position_in: StaffPositionCreate, session: Session = Depends(get_db)):
    return create_position(session, property_id, position_in)

@router.get("/employees", response_model=List[StaffEmployeeRead])
def api_get_employees(property_id: int, session: Session = Depends(get_db)):
    return get_employees(session, property_id)

@router.post("/employees", response_model=StaffEmployeeRead)
def api_create_employee(property_id: int, employee_in: StaffEmployeeCreate, session: Session = Depends(get_db)):
    return create_employee(session, property_id, employee_in)

@router.put("/employees/{employee_id}", response_model=StaffEmployeeRead)
def api_update_employee(property_id: int, employee_id: int, employee_in: StaffEmployeeUpdate, session: Session = Depends(get_db)):
    return update_employee(session, property_id, employee_id, employee_in)

@router.get("/monthly", response_model=List[MonthlyPayrollRead])
def api_get_payrolls(property_id: int, period: Optional[str] = None, session: Session = Depends(get_db)):
    return get_payrolls(session, property_id, period)

@router.post("/monthly", response_model=MonthlyPayrollRead)
def api_create_payroll(
    property_id: int,
    period: str = Form(...),
    configuration: str = Form("company_cost"),
    company_cost: float = Form(0.0),
    net_amount: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
    employee_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    session: Session = Depends(get_db)
):
    attachment_url = None
    if file:
        file_bytes = file.file.read()
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
        object_key = f"payrolls/{property_id}/{period}/{uuid.uuid4()}.{file_ext}"
        attachment_url = upload_to_minio(file_bytes, object_key)
        
    payroll_in = MonthlyPayrollCreate(
        employee_id=employee_id,
        period=period,
        configuration=configuration,
        company_cost=company_cost,
        net_amount=net_amount,
        notes=notes
    )
    return create_payroll(session, property_id, payroll_in, attachment_url)

@router.put("/monthly/{payroll_id}", response_model=MonthlyPayrollRead)
def api_update_payroll(property_id: int, payroll_id: int, payroll_in: MonthlyPayrollUpdate, session: Session = Depends(get_db)):
    return update_payroll(session, property_id, payroll_id, payroll_in)

@router.delete("/monthly/{payroll_id}")
def api_delete_payroll(property_id: int, payroll_id: int, session: Session = Depends(get_db)):
    return delete_payroll(session, property_id, payroll_id)

@router.post("/monthly/duplicate")
def api_duplicate_payrolls(property_id: int, dup_in: MonthlyPayrollDuplicate, session: Session = Depends(get_db)):
    return duplicate_payrolls(session, property_id, dup_in)
