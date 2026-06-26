from sqlmodel import Session, select
from fastapi import HTTPException, status
from typing import List

from app.module.incidents.model import OperationalIncident
from app.module.incidents.schema import IncidentCreate
from app.core.translation import translate

def get_incidents(db: Session) -> List[OperationalIncident]:
    """Retrieves all operational incidents ordered by creation date descending."""
    statement = select(OperationalIncident).order_by(OperationalIncident.created_at.desc())
    return db.exec(statement).all()

def resolve_incident(db: Session, incident_id: int, lang: str = "en") -> OperationalIncident:
    """Marks an active incident as resolved."""
    incident = db.get(OperationalIncident, incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=translate("not_found", lang)
        )
        
    incident.status = "RESOLVED"
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident

def create_manual_incident(db: Session, dto: IncidentCreate) -> OperationalIncident:
    """Manually logs an operational incident."""
    incident = OperationalIncident(
        type=dto.type,
        severity=dto.severity,
        message=dto.message,
        status="OPEN"
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident
