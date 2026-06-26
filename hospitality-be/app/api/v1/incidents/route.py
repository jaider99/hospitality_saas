from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from typing import List

from app.db.session import get_db
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.module.incidents.schema import IncidentCreate, IncidentResponse
from app.module.incidents.service import (
    get_incidents,
    resolve_incident,
    create_manual_incident
)
from app.core.translation import get_lang

router = APIRouter()

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all operational incidents."""
    return get_incidents(db)

@router.put("/{incident_id}/resolve", response_model=IncidentResponse)
def put_resolve_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """Marks an operational incident as resolved."""
    return resolve_incident(db, incident_id, lang=lang)

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def post_manual_incident(
    dto: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually registers an operational exception."""
    return create_manual_incident(db, dto)
