from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from datetime import datetime

from app.db.session import get_db
from app.module.invoices.model import Supplier, SupplierContact
from app.module.suppliers.schema import SupplierCreate, SupplierRead, SupplierUpdate, SupplierContactCreate
from app.module.auth.model import User
from app.module.auth.service import get_current_user

router = APIRouter(tags=["Suppliers"])

@router.get("", response_model=List[SupplierRead])
def get_suppliers(
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch all suppliers that are not soft-deleted
    statement = select(Supplier).where(Supplier.deleted_at == None, Supplier.restaurant_id == current_user.restaurant_id).order_by(Supplier.name)
    suppliers = session.exec(statement).all()
    return suppliers

@router.get("/{supplier_id}", response_model=SupplierRead)
def get_supplier(
    supplier_id: int, 
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    statement = select(Supplier).where(Supplier.id == supplier_id, Supplier.restaurant_id == current_user.restaurant_id)
    supplier = session.exec(statement).first()
    if not supplier or supplier.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(
    supplier_in: SupplierCreate, 
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Build supplier from dict, excluding contacts (handled separately)
    supplier_data = supplier_in.dict(exclude={"contacts"})
    supplier_data["restaurant_id"] = current_user.restaurant_id
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
def update_supplier(
    supplier_id: int, 
    supplier_in: SupplierUpdate, 
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    statement = select(Supplier).where(Supplier.id == supplier_id, Supplier.restaurant_id == current_user.restaurant_id)
    db_supplier = session.exec(statement).first()
    if not db_supplier or db_supplier.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    supplier_data = supplier_in.dict(exclude_unset=True, exclude={"contacts"})
    for key, value in supplier_data.items():
        setattr(db_supplier, key, value)
        
    db_supplier.updated_at = datetime.utcnow()
    session.add(db_supplier)
    
    # Handle contacts if provided
    if supplier_in.contacts is not None:
        statement = select(SupplierContact).where(SupplierContact.supplier_id == supplier_id)
        existing_contacts = session.exec(statement).all()
        existing_contacts_dict = {c.id: c for c in existing_contacts}

        incoming_ids = [c.id for c in supplier_in.contacts if getattr(c, 'id', None) is not None]

        # Delete contacts not in incoming list
        for c_id, c in existing_contacts_dict.items():
            if c_id not in incoming_ids:
                session.delete(c)

        # Update existing or create new
        for contact_in in supplier_in.contacts:
            if getattr(contact_in, 'id', None) is not None and contact_in.id in existing_contacts_dict:
                # Update
                db_contact = existing_contacts_dict[contact_in.id]
                for key, value in contact_in.dict(exclude_unset=True).items():
                    if key != 'id':
                        setattr(db_contact, key, value)
                db_contact.updated_at = datetime.utcnow()
                session.add(db_contact)
            else:
                # Create
                contact_data = contact_in.dict()
                contact_data.pop('id', None)
                db_contact = SupplierContact(**contact_data, supplier_id=supplier_id)
                session.add(db_contact)
            
    session.commit()
    session.refresh(db_supplier)
    return db_supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int, 
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    statement = select(Supplier).where(Supplier.id == supplier_id, Supplier.restaurant_id == current_user.restaurant_id)
    db_supplier = session.exec(statement).first()
    if not db_supplier or db_supplier.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Soft delete supplier
    now = datetime.utcnow()
    db_supplier.deleted_at = now
    
    # Soft delete contacts
    for contact in db_supplier.contact_list:
        contact.deleted_at = now
        session.add(contact)
        
    # Soft delete products and their cost history
    for product in db_supplier.products:
        product.deleted_at = now
        session.add(product)
        for cost in product.cost_history:
            cost.deleted_at = now
            session.add(cost)
        
    # Soft delete invoices and their child entities
    for invoice in db_supplier.invoices:
        invoice.deleted_at = now
        session.add(invoice)
        for line in invoice.lines:
            line.deleted_at = now
            session.add(line)
        for tb in invoice.tax_brackets:
            tb.deleted_at = now
            session.add(tb)

    session.add(db_supplier)
    session.commit()
    return None
