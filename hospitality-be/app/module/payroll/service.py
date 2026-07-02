from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException
from app.module.payroll.model import StaffPosition, StaffRole, StaffEmployee, MonthlyPayroll
from app.module.payroll.schema import (
    StaffPositionCreate, StaffPositionUpdate,
    StaffEmployeeCreate, StaffEmployeeUpdate,
    MonthlyPayrollCreate, MonthlyPayrollUpdate, MonthlyPayrollDuplicate
)

def get_positions(session: Session, property_id: int) -> List[StaffPosition]:
    statement = select(StaffPosition).where(StaffPosition.property_id == property_id)
    return session.exec(statement).all()

def create_position(session: Session, property_id: int, position_in: StaffPositionCreate) -> StaffPosition:
    db_position = StaffPosition(**position_in.model_dump(), property_id=property_id)
    session.add(db_position)
    session.commit()
    session.refresh(db_position)
    return db_position

def get_employees(session: Session, property_id: int) -> List[StaffEmployee]:
    statement = select(StaffEmployee).where(StaffEmployee.property_id == property_id)
    return session.exec(statement).all()

def create_employee(session: Session, property_id: int, employee_in: StaffEmployeeCreate) -> StaffEmployee:
    db_employee = StaffEmployee(**employee_in.model_dump(), property_id=property_id)
    session.add(db_employee)
    session.commit()
    session.refresh(db_employee)
    return db_employee

def update_employee(session: Session, property_id: int, employee_id: int, employee_in: StaffEmployeeUpdate) -> StaffEmployee:
    db_employee = session.get(StaffEmployee, employee_id)
    if not db_employee or db_employee.property_id != property_id:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = employee_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_employee, key, value)
    
    db_employee.updated_at = datetime.utcnow()
    session.add(db_employee)
    session.commit()
    session.refresh(db_employee)
    return db_employee

def get_payrolls(session: Session, property_id: int, period: Optional[str] = None) -> List[MonthlyPayroll]:
    statement = select(MonthlyPayroll).where(MonthlyPayroll.property_id == property_id)
    if period:
        statement = statement.where(MonthlyPayroll.period == period)
    return session.exec(statement).all()

def create_payroll(session: Session, property_id: int, payroll_in: MonthlyPayrollCreate, attachment_url: Optional[str] = None) -> MonthlyPayroll:
    # Check if employee belongs to property
    if payroll_in.employee_id:
        emp = session.get(StaffEmployee, payroll_in.employee_id)
        if not emp or emp.property_id != property_id:
            raise HTTPException(status_code=400, detail="Employee not found or does not belong to property")

    db_payroll = MonthlyPayroll(
        **payroll_in.model_dump(),
        property_id=property_id,
        attachment_url=attachment_url
    )
    session.add(db_payroll)
    session.commit()
    session.refresh(db_payroll)
    return db_payroll

def update_payroll(session: Session, property_id: int, payroll_id: int, payroll_in: MonthlyPayrollUpdate) -> MonthlyPayroll:
    db_payroll = session.get(MonthlyPayroll, payroll_id)
    if not db_payroll or db_payroll.property_id != property_id:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    update_data = payroll_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_payroll, key, value)
        
    db_payroll.updated_at = datetime.utcnow()
    session.add(db_payroll)
    session.commit()
    session.refresh(db_payroll)
    return db_payroll

def delete_payroll(session: Session, property_id: int, payroll_id: int):
    db_payroll = session.get(MonthlyPayroll, payroll_id)
    if not db_payroll or db_payroll.property_id != property_id:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    session.delete(db_payroll)
    session.commit()
    return {"status": "success", "message": "Payroll deleted successfully"}

def duplicate_payrolls(session: Session, property_id: int, dup_in: MonthlyPayrollDuplicate):
    # Fetch all payrolls in source period
    statement = select(MonthlyPayroll).where(
        MonthlyPayroll.property_id == property_id,
        MonthlyPayroll.period == dup_in.source_period
    )
    source_payrolls = session.exec(statement).all()
    
    if not source_payrolls:
        raise HTTPException(status_code=404, detail="No payrolls found in the source period")
    
    # Delete existing target period payrolls first to prevent duplicates?
    # Or just add? The design says "Bulk duplication endpoint... whether it should copy notes/attachments.yes"
    # It might create duplicates if run twice. I will just add them.
    
    new_payrolls = []
    for sp in source_payrolls:
        np = MonthlyPayroll(
            property_id=property_id,
            employee_id=sp.employee_id,
            period=dup_in.target_period,
            configuration=sp.configuration,
            company_cost=sp.company_cost,
            net_amount=sp.net_amount,
            notes=sp.notes if dup_in.copy_notes else None,
            attachment_url=sp.attachment_url if dup_in.copy_attachments else None
        )
        session.add(np)
        new_payrolls.append(np)
        
    session.commit()
    for np in new_payrolls:
        session.refresh(np)
        
    return {"message": f"Duplicated {len(new_payrolls)} payrolls"}
