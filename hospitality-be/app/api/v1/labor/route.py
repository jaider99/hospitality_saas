from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from typing import List, Dict, Any

from app.db.session import get_db
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.module.labor.schema import StaffCreate, ClockInRequest, ClockOutRequest, LaborAuditRequest, StaffResponse, ShiftResponse
from app.module.labor.service import (
    create_staff_member,
    get_staff,
    clock_in,
    clock_out,
    get_shifts,
    run_labor_audit
)
from app.core.translation import get_lang

router = APIRouter()

@router.post("/staff", status_code=status.HTTP_201_CREATED)
def post_staff(
    dto: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registers a new staff member profile."""
    staff = create_staff_member(db, dto)
    return {
        "id": staff.id,
        "name": staff.name,
        "role": staff.role,
        "hourlyRate": staff.hourly_rate
    }

@router.get("/staff", response_model=List[StaffResponse])
def list_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all staff profiles with shift statistics."""
    return get_staff(db)

@router.post("/clock-in")
def post_clock_in(
    dto: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """Records staff member shift start time."""
    shift = clock_in(db, dto, lang=lang)
    return {
        "id": shift.id,
        "staffId": shift.staff_id,
        "clockIn": shift.clock_in,
        "clockOut": shift.clock_out
    }

@router.post("/clock-out")
def post_clock_out(
    dto: ClockOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """Closes staff member active shift, calculating hours and wages."""
    shift = clock_out(db, dto, lang=lang)
    return {
        "id": shift.id,
        "staffId": shift.staff_id,
        "clockIn": shift.clock_in,
        "clockOut": shift.clock_out,
        "totalHours": shift.total_hours,
        "totalPay": shift.total_pay
    }

@router.get("/shifts")
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists recent staff shift logs."""
    shifts = get_shifts(db)
    result = []
    for sh in shifts:
        staff_data = {
            "id": sh.staff.id,
            "name": sh.staff.name,
            "role": sh.staff.role,
            "hourlyRate": sh.staff.hourly_rate,
            "shiftsCount": 0  # Dummy placeholder
        }
        result.append({
            "id": sh.id,
            "staffId": sh.staff_id,
            "clockIn": sh.clock_in,
            "clockOut": sh.clock_out,
            "totalHours": sh.total_hours,
            "totalPay": sh.total_pay,
            "staff": staff_data
        })
    return result

@router.post("/audit")
def post_labor_audit(
    dto: LaborAuditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """Runs a labor audit checking active payroll cost ratio against estimated sales."""
    return run_labor_audit(db, dto.estimatedSales, lang=lang)
