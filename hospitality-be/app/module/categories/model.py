from sqlmodel import SQLModel, Field, Relationship, UniqueConstraint
from datetime import datetime
from typing import Optional, List
import uuid

def generate_category_id() -> str:
    return f"CAT-{uuid.uuid4().hex[:8].upper()}"

class Category(SQLModel, table=True):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "name", name="uq_category_restaurant_name"),
    )
    
    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: Optional[int] = Field(default=None, foreign_key="restaurant.id", index=True)
    category_id: str = Field(default_factory=generate_category_id, unique=True)
    name: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    color: Optional[str] = Field(default="#000000")
    
    # Self-referential relationship for sub-categories
    parent_category_id: Optional[str] = Field(default=None, foreign_key="categories.category_id")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    sub_categories: List["Category"] = Relationship(
        back_populates="parent_category",
        sa_relationship_kwargs={"remote_side": "Category.category_id"}
    )
    parent_category: Optional["Category"] = Relationship(back_populates="sub_categories")
    
    # Relationship to Suppliers will be defined in the Supplier model using back_populates
    suppliers: List["Supplier"] = Relationship(back_populates="category")

# Import Supplier at the bottom to avoid circular dependency
from app.module.invoices.model import Supplier
