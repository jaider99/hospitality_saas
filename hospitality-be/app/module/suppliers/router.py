from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from datetime import datetime

from app.db.session import get_db
from app.module.invoices.model import Supplier, SupplierContact
from app.module.suppliers.schema import SupplierCreate, SupplierRead, SupplierUpdate, SupplierContactCreate

router = APIRouter(tags=["Suppliers"])

@router.get("", response_model=List[SupplierRead])
def get_suppliers(session: Session = Depends(get_db)):
    # Fetch all suppliers that are not soft-deleted
    statement = select(Supplier).where(Supplier.deleted_at == None).order_by(Supplier.name)
    suppliers = session.exec(statement).all()
    return suppliers

@router.get("/{supplier_id}", response_model=SupplierRead)
def get_supplier(supplier_id: int, session: Session = Depends(get_db)):
    supplier = session.get(Supplier, supplier_id)
    if not supplier or supplier.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier_in: SupplierCreate, session: Session = Depends(get_db)):
    # Build supplier from dict, excluding contacts (handled separately)
    supplier_data = supplier_in.dict(exclude={"contacts"})
    db_supplier = Supplier(**supplier_data)
    
    session.add(db_supplier)
    session.commit()
    session.refresh(db_supplier)
    
    # Add contacts
    if supplier_in.contacts:
        for contact_in in supplier_in.contacts:
            db_contact = SupplierContact(**contact_in.dict(), supplier_id=db_supplier.id)
            session.add(db_contact)
        session.commit()
        session.refresh(db_supplier)
        
    return db_supplier

@router.put("/{supplier_id}", response_model=SupplierRead)
def update_supplier(supplier_id: int, supplier_in: SupplierUpdate, session: Session = Depends(get_db)):
    db_supplier = session.get(Supplier, supplier_id)
    if not db_supplier or db_supplier.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    supplier_data = supplier_in.dict(exclude_unset=True, exclude={"contacts"})
    for key, value in supplier_data.items():
        setattr(db_supplier, key, value)
        
    db_supplier.updated_at = datetime.utcnow()
    session.add(db_supplier)
    
    # Handle contacts if provided
    if supplier_in.contacts is not None:
        # For simplicity, we drop existing contacts and recreate them when updating
        statement = select(SupplierContact).where(SupplierContact.supplier_id == supplier_id)
        existing_contacts = session.exec(statement).all()
        for c in existing_contacts:
            session.delete(c)
            
        for contact_in in supplier_in.contacts:
            db_contact = SupplierContact(**contact_in.dict(), supplier_id=supplier_id)
            session.add(db_contact)
            
    session.commit()
    session.refresh(db_supplier)
    return db_supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, session: Session = Depends(get_db)):
    db_supplier = session.get(Supplier, supplier_id)
    if not db_supplier or db_supplier.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Soft delete
    db_supplier.deleted_at = datetime.utcnow()
    session.add(db_supplier)
    session.commit()
    return None
