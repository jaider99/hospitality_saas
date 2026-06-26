from sqlmodel import Session, select
from fastapi import HTTPException, status
from datetime import datetime
from typing import List, Dict, Any

from app.module.labor.model import StaffMember, StaffShift
from app.module.incidents.model import OperationalIncident
from app.core.config import TARGET_LABOR_PERCENTAGE, UNDERSTAFFING_LABOR_PERCENTAGE
from app.core.translation import translate

def create_staff_member(db: Session, dto: Any) -> StaffMember:
    """Registers a new staff member profile."""
    staff = StaffMember(
        name=dto.name,
        role=dto.role.upper(),
        hourly_rate=dto.hourlyRate
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff

def get_staff(db: Session) -> List[Dict[str, Any]]:
    """Retrieves list of staff members with shifts count."""
    statement = select(StaffMember).order_by(StaffMember.name.asc())
    staff_members = db.exec(statement).all()
    
    result = []
    for staff in staff_members:
        result.append({
            "id": staff.id,
            "name": staff.name,
            "role": staff.role,
            "hourlyRate": staff.hourly_rate,
            "shiftsCount": len(staff.shifts)
        })
    return result

def clock_in(db: Session, dto: Any, lang: str = "en") -> StaffShift:
    """Clocks a staff member in. Throws error if already clocked in."""
    staff = db.get(StaffMember, dto.staffId)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=translate("not_found", lang)
        )
        
    # Check if already clocked in
    statement = select(StaffShift).where(
        StaffShift.staff_id == dto.staffId,
        StaffShift.clock_out == None
    )
    active_shift = db.exec(statement).first()
    if active_shift:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=translate("invalid_shift", lang)
        )
        
    shift = StaffShift(
        staff_id=dto.staffId,
        clock_in=datetime.utcnow()
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift

def clock_out(db: Session, dto: Any, lang: str = "en") -> StaffShift:
    """Clocks a staff member out, computing total hours and pay."""
    # Find active shift
    statement = select(StaffShift).where(
        StaffShift.staff_id == dto.staffId,
        StaffShift.clock_out == None
    )
    shift = db.exec(statement).first()
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=translate("not_clocked_in", lang)
        )
        
    clock_out_time = datetime.utcnow()
    clock_in_time = shift.clock_in
    
    # Calculate hours difference
    diff = clock_out_time - clock_in_time
    hours = max(0.1, diff.total_seconds() / 3600.0)  # Min 0.1 hours
    
    # Calculate pay
    total_pay = shift.staff.hourly_rate * hours
    
    shift.clock_out = clock_out_time
    shift.total_hours = round(hours, 2)
    shift.total_pay = round(total_pay, 2)
    
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift

def get_shifts(db: Session) -> List[StaffShift]:
    """Retrieves all shifts ordered by clock-in date descending."""
    statement = select(StaffShift).order_by(StaffShift.clock_in.desc())
    return db.exec(statement).all()

def run_labor_audit(db: Session, estimated_sales: float, lang: str = "en") -> Dict[str, Any]:
    """
    Audits currently clocked-in staff against projected sales.
    Triggers 'LABOR_COST' incident warnings if ratios exceed limits (>30% or <15%).
    """
    sales = estimated_sales if estimated_sales > 0 else 1000.0
    
    # Find active shifts
    statement = select(StaffShift).where(StaffShift.clock_out == None)
    active_shifts = db.exec(statement).all()
    
    active_hourly_pay_rate = 0.0
    role_counts = {"CHEF": 0, "WAITER": 0, "MANAGER": 0, "HOST": 0}
    
    for shift in active_shifts:
        active_hourly_pay_rate += shift.staff.hourly_rate
        role = shift.staff.role.upper()
        if role in role_counts:
            role_counts[role] += 1
            
    # Assume standard 8-hour shift labor cost projection
    projected_labor_cost = active_hourly_pay_rate * 8.0
    labor_ratio = (projected_labor_cost / sales) * 100
    
    audit_result = {
        "sales": sales,
        "activeStaffCount": len(active_shifts),
        "activeHourlyRate": active_hourly_pay_rate,
        "projectedLaborCost": projected_labor_cost,
        "laborRatioPercentage": labor_ratio,
        "targetLaborPercentage": TARGET_LABOR_PERCENTAGE,
        "recommendsChange": False,
        "recommendation": translate("labor_healthy", lang)
    }
    
    if labor_ratio > TARGET_LABOR_PERCENTAGE:
        audit_result["recommendsChange"] = True
        
        # Check waiter ratio
        if role_counts["WAITER"] > role_counts["CHEF"] * 2:
            recommendation_msg = translate(
                "labor_excess_msg",
                lang=lang,
                actual=labor_ratio,
                cost=projected_labor_cost
            )
        else:
            recommendation_msg = translate(
                "labor_excess_chef_msg",
                lang=lang,
                actual=labor_ratio,
                cost=projected_labor_cost
            )
            
        audit_result["recommendation"] = recommendation_msg
        
        # Create operational incident
        incident = OperationalIncident(
            type="LABOR_COST",
            severity="HIGH",
            message=recommendation_msg,
            status="OPEN"
        )
        db.add(incident)
        db.commit()
        
    elif labor_ratio < UNDERSTAFFING_LABOR_PERCENTAGE and len(active_shifts) > 0:
        audit_result["recommendsChange"] = True
        
        recommendation_msg = translate(
            "labor_understaffed_msg",
            lang=lang,
            actual=labor_ratio,
            cost=projected_labor_cost
        )
        audit_result["recommendation"] = recommendation_msg
        
        # Create operational incident
        incident = OperationalIncident(
            type="LABOR_COST",
            severity="MEDIUM",
            message=recommendation_msg,
            status="OPEN"
        )
        db.add(incident)
        db.commit()
        
    return audit_result
