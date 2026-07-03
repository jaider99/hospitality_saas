from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from datetime import datetime

from app.db.session import get_db
from app.module.categories.model import Category
from app.module.categories.schema import CategoryCreate, CategoryRead, CategoryUpdate
from app.module.invoices.model import Supplier

router = APIRouter(tags=["Categories"])

@router.get("", response_model=List[CategoryRead])
def get_categories(session: Session = Depends(get_db)):
    # Fetch all categories that are not soft-deleted
    statement = select(Category).where(Category.deleted_at == None).order_by(Category.name)
    categories = session.exec(statement).all()
    return categories

@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, session: Session = Depends(get_db)):
    category = session.get(Category, category_id)
    if not category or category.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(category_in: CategoryCreate, session: Session = Depends(get_db)):
    # Check if category with same name already exists
    statement = select(Category).where(Category.name == category_in.name, Category.deleted_at == None)
    existing_category = session.exec(statement).first()
    if existing_category:
        raise HTTPException(status_code=400, detail="category already exists")

    db_category = Category.from_orm(category_in)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category

@router.put("/{category_id}", response_model=CategoryRead)
def update_category(category_id: int, category_in: CategoryUpdate, session: Session = Depends(get_db)):
    db_category = session.get(Category, category_id)
    if not db_category or db_category.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # If name is being updated, check uniqueness
    if category_in.name and category_in.name != db_category.name:
        statement = select(Category).where(Category.name == category_in.name, Category.deleted_at == None)
        existing_category = session.exec(statement).first()
        if existing_category:
            raise HTTPException(status_code=400, detail="category already exists")

    category_data = category_in.dict(exclude_unset=True)
    for key, value in category_data.items():
        setattr(db_category, key, value)
        
    db_category.updated_at = datetime.utcnow()
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, session: Session = Depends(get_db)):
    db_category = session.get(Category, category_id)
    if not db_category or db_category.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Find all descendants (in-memory traversal for simplicity)
    all_categories = session.exec(select(Category).where(Category.deleted_at == None)).all()
    
    child_map = {}
    for cat in all_categories:
        if cat.parent_category_id:
            child_map.setdefault(cat.parent_category_id, []).append(cat)
            
    descendants = set()
    descendant_ids = set()
    def get_descendants(cat_str_id):
        for child in child_map.get(cat_str_id, []):
            descendants.add(child.category_id)
            descendant_ids.add(child.id)
            get_descendants(child.category_id)
            
    if db_category.category_id:
        get_descendants(db_category.category_id)
        
    string_ids_to_check = {db_category.category_id} | descendants
    integer_ids_to_delete = {category_id} | descendant_ids
    
    # Check if any supplier uses any of these categories
    statement = select(Supplier).where(Supplier.category_id.in_(list(string_ids_to_check)), Supplier.deleted_at == None)
    attached_supplier = session.exec(statement).first()
    
    if attached_supplier:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete category because it or one of its sub-categories is attached to a supplier."
        )
        
    # Soft delete
    now = datetime.utcnow()
    for cid in integer_ids_to_delete:
        cat = session.get(Category, cid)
        if cat:
            cat.deleted_at = now
            session.add(cat)
            
    session.commit()
    return None
