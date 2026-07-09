"""
Products & Inventory SQLModel Tables
=====================================
Standalone OCR-powered product tracking:
  - Product: normalized product records
  - ProductAlias: learned name aliases (replaces product_references + referenced_items)
  - ProductSupplier: product <-> supplier junction
  - ProductFormat: purchase unit conversions
  - Inventory / InventoryItem: stock sessions

Key design decisions:
  - Product IDs: "prod~<hex>" strings (generated locally, no Haddock dependency)
  - Purchase history is derived via alias lookup on invoice_lines (no product_references needed)
  - ProductAlias is the single source of truth for name-to-product mapping
"""

from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from datetime import datetime
from typing import Optional, List, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.module.categories.model import Category as AppCategory


# ---------------------------------------------------------------------------
# 1. Expense Categories (hierarchical, self-referencing)
# ---------------------------------------------------------------------------

class ExpenseCategory(SQLModel, table=True):
    """
    Hierarchical expense/product category tree.

    Example path (leaf -> parent -> root):
      "spices" -> "seasoning-spices-and-sweeteners" -> "raw-materials"
    """
    __tablename__ = "expense_categories"

    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    color: Optional[str] = Field(default=None)
    parent_id: Optional[str] = Field(
        default=None,
        foreign_key="expense_categories.id",
        index=True,
        nullable=True,
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    products: List["Product"] = Relationship(back_populates="category")


# ---------------------------------------------------------------------------
# 2. Product (core normalized product record)
# ---------------------------------------------------------------------------

class Product(SQLModel, table=True):
    """
    Normalized product record aggregated from invoice line items.

    Purchase history is derived at query time by matching invoice_lines.description
    against the product name and its ProductAlias entries (case-insensitive exact match).
    """
    __tablename__ = "products"

    id: str = Field(primary_key=True)
    name: str = Field(index=True)

    # Pricing fields
    reference_price: Optional[float] = Field(default=None)
    last_price: Optional[float] = Field(default=None)
    total: float = Field(default=0.0)
    quantity: Optional[float] = Field(default=None)
    price_difference_percentage: Optional[float] = Field(default=None)

    # Units
    unit_of_measure: Optional[str] = Field(default=None)
    unit_of_measure_source: Optional[str] = Field(default=None)

    # Tax
    tax_rate: Optional[float] = Field(default=None)

    # Status flags
    status: str = Field(default="ACTIVE")
    suggested_master_product_id: Optional[str] = Field(default=None, index=True)
    bookmarked: bool = Field(default=False)
    archived: bool = Field(default=False)
    merged: bool = Field(default=False)
    imported: bool = Field(default=False)

    config: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    # Category FK (legacy Haddock expense_categories)
    category_id: Optional[str] = Field(
        default=None,
        foreign_key="expense_categories.id",
        index=True,
        nullable=True,
    )

    # Category FK (new app categories table, used in UI)
    app_category_id: Optional[str] = Field(
        default=None,
        foreign_key="categories.category_id",
        index=True,
        nullable=True,
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    category: Optional[ExpenseCategory] = Relationship(back_populates="products")
    product_suppliers: List["ProductSupplier"] = Relationship(
        back_populates="product", cascade_delete=True
    )
    formats: List["ProductFormat"] = Relationship(
        back_populates="product", cascade_delete=True
    )
    inventory_items: List["InventoryItem"] = Relationship(back_populates="product")
    aliases: List["ProductAlias"] = Relationship(back_populates="product", cascade_delete=True)


# ---------------------------------------------------------------------------
# 3. Product <-> Supplier join table (many-to-many)
# ---------------------------------------------------------------------------

class ProductSupplier(SQLModel, table=True):
    """Junction table: a Product can be sourced from multiple Suppliers."""
    __tablename__ = "product_suppliers"

    product_id: str = Field(
        foreign_key="products.id", primary_key=True, ondelete="CASCADE"
    )
    supplier_id: int = Field(
        foreign_key="suppliers.id", primary_key=True, ondelete="CASCADE"
    )
    haddock_supplier_id: Optional[str] = Field(default=None, index=True)

    # Relationships
    product: Product = Relationship(back_populates="product_suppliers")


# ---------------------------------------------------------------------------
# 4. Product Formats (how a product is purchased vs its base unit)
# ---------------------------------------------------------------------------

class ProductFormat(SQLModel, table=True):
    """
    A product can be purchased in multiple units (e.g. "box of 6" vs "per kg").
    Stores the conversion factor to translate purchase quantities to a base unit.
    """
    __tablename__ = "product_formats"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: str = Field(foreign_key="products.id", ondelete="CASCADE", index=True)

    purchase_unit: str
    conversion_factor: float
    base_unit: str
    base_unit_source: Optional[str] = Field(default=None)

    price_per_base_unit: Optional[float] = Field(default=None)

    supplier_id: Optional[int] = Field(
        default=None, foreign_key="suppliers.id", nullable=True
    )

    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    product: Product = Relationship(back_populates="formats")


# ---------------------------------------------------------------------------
# 5. Inventory (a named inventory session / count event)
# ---------------------------------------------------------------------------

class Inventory(SQLModel, table=True):
    """An inventory session - a specific stock-count event."""
    __tablename__ = "inventories"

    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    items: List["InventoryItem"] = Relationship(back_populates="inventory", cascade_delete=True)


# ---------------------------------------------------------------------------
# 6. Inventory Item (a single line in an inventory session)
# ---------------------------------------------------------------------------

class InventoryItem(SQLModel, table=True):
    """
    A single line in an inventory session.
    kind = "product" -> links to Product via product_id
    kind = "dish"    -> links to a Recipe/Dish via dish_id
    """
    __tablename__ = "inventory_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    inventory_id: str = Field(
        foreign_key="inventories.id", index=True, ondelete="CASCADE"
    )

    kind: str = Field(default="product", index=True)
    name: str

    product_id: Optional[str] = Field(
        default=None, foreign_key="products.id", nullable=True, index=True
    )
    dish_id: Optional[str] = Field(default=None, index=True, nullable=True)
    recipe_id: Optional[int] = Field(
        default=None, foreign_key="recipe.id", nullable=True
    )

    price_per_unit: float = Field(default=0.0)
    conversion_factor: float = Field(default=1.0)
    base_unit: Optional[str] = Field(default=None)
    base_unit_source: Optional[str] = Field(default=None)

    warehouse_quantity: float = Field(default=0.0)
    purchase_quantity: float = Field(default=0.0)
    purchase_unit_of_measure: Optional[str] = Field(default=None)

    total_accumulated: float = Field(default=0.0)

    supplier_id: Optional[int] = Field(
        default=None, foreign_key="suppliers.id", nullable=True
    )
    haddock_supplier_id: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    inventory: Inventory = Relationship(back_populates="items")
    product: Optional[Product] = Relationship(back_populates="inventory_items")


# ---------------------------------------------------------------------------
# 7. Product Alias (single source of truth for name-to-product mapping)
# ---------------------------------------------------------------------------

class ProductAlias(SQLModel, table=True):
    """
    Stores learned name aliases for products.

    This replaces the old product_references + referenced_items tables.
    Purchase history is built by querying invoice_lines WHERE description
    (case-insensitive) matches the product name OR any of its aliases.

    Rules:
      - alias_name is always stored lowercased
      - Created automatically on exact-match auto-link OR when user approves
        a review queue merge
      - Every product also implicitly matches its own name (no alias row needed)
    """
    __tablename__ = "product_aliases"

    id: Optional[int] = Field(default=None, primary_key=True)
    alias_name: str = Field(index=True)
    master_product_id: str = Field(foreign_key="products.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    product: Product = Relationship(back_populates="aliases")
