"""
Products & Inventory SQLModel Tables
=====================================
Mirrors the Haddock API structure for:
  - /api/products  → Product, ExpenseCategory, ProductSupplier, ReferencedItem, ProductReference
  - /api/inventories/{id}/items → Inventory, InventoryItem

Key design decisions:
  - Haddock external IDs (prod~, expcat~, supp~, inve~, item~, dish~) stored as TEXT PKs.
  - Links to existing `suppliers` table (integer PK) via ProductSupplier.
  - InventoryItem supports both kind="product" and kind="dish" rows.
  - Category tree is self-referencing (up to 3 levels: root → parent → leaf).
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

    Example path (leaf → parent → root):
      "spices" → "seasoning-spices-and-sweeteners" → "raw-materials"

    Haddock uses string IDs like "expcat~34r_KrT6S06jtAL-0Mk2xQ".
    """
    __tablename__ = "expense_categories"

    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    color: Optional[str] = Field(default=None)           # e.g. "#FFD766" or "transparent"
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

    A single Product may be backed by multiple ReferencedItems (expense lines)
    when Haddock's algorithm merges near-identical invoice descriptions.
    Reference price is typically a 12-month weighted average (configurable).
    """
    __tablename__ = "products"

    # External Haddock ID, e.g. "prod~88RCU-PCRTqHY-0-W5Ekvw"
    id: str = Field(primary_key=True)
    name: str = Field(index=True)

    # Pricing fields
    reference_price: Optional[float] = Field(default=None)
    last_price: Optional[float] = Field(default=None)
    total: float = Field(default=0.0)
    quantity: Optional[float] = Field(default=None)
    price_difference_percentage: Optional[float] = Field(default=None)

    # Units
    unit_of_measure: Optional[str] = Field(default=None)        # ud / kg / l / ml / gr
    unit_of_measure_source: Optional[str] = Field(default=None) # "automatic" | "manual"

    # Tax
    tax_rate: Optional[float] = Field(default=None)

    # Status flags
    status: str = Field(default="ACTIVE") # 'ACTIVE', 'PENDING_NEW', 'PENDING_MERGE'
    suggested_master_product_id: Optional[str] = Field(default=None, index=True)
    bookmarked: bool = Field(default=False)
    archived: bool = Field(default=False)
    merged: bool = Field(default=False)
    imported: bool = Field(default=False)

    # Reference price config: {"type": "average", "value": 12, "measure": "months"}
    config: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    # Category FK → Haddock expense_categories (legacy sync)
    category_id: Optional[str] = Field(
        default=None,
        foreign_key="expense_categories.id",
        index=True,
        nullable=True,
    )

    # Category FK → our categories table (new system, used in UI)
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
    referenced_items: List["ProductReference"] = Relationship(
        back_populates="product", cascade_delete=True
    )
    formats: List["ProductFormat"] = Relationship(
        back_populates="product", cascade_delete=True
    )
    inventory_items: List["InventoryItem"] = Relationship(back_populates="product")


# ---------------------------------------------------------------------------
# 3. Product <-> Supplier join table (many-to-many)
# ---------------------------------------------------------------------------

class ProductSupplier(SQLModel, table=True):
    """
    Junction table: a Product can be sourced from multiple Suppliers.
    Links Haddock product string ID to our integer supplier PK.
    """
    __tablename__ = "product_suppliers"

    product_id: str = Field(
        foreign_key="products.id", primary_key=True, ondelete="CASCADE"
    )
    supplier_id: int = Field(
        foreign_key="suppliers.id", primary_key=True, ondelete="CASCADE"
    )
    # Haddock string supplier ID for sync lookups ("supp~…")
    haddock_supplier_id: Optional[str] = Field(default=None, index=True)

    # Relationships
    product: Product = Relationship(back_populates="product_suppliers")


# ---------------------------------------------------------------------------
# 4. Referenced Items (raw expense line references)
# ---------------------------------------------------------------------------

class ReferencedItem(SQLModel, table=True):
    """
    An individual expense/invoice line item that backs a Product.
    Haddock's "item~…" IDs - these are the raw purchase line records.
    A single Product aggregates many ReferencedItems when invoice lines are merged.
    """
    __tablename__ = "referenced_items"

    # External Haddock item ID, e.g. "item~lU4oi-UPSdm4nvpc5NoUTA"
    id: str = Field(primary_key=True)
    expense_item_name: Optional[str] = Field(default=None)
    supplier_name: Optional[str] = Field(default=None)

    # Optional FK to our invoice_lines table (matched by OCR pipeline)
    invoice_line_id: Optional[int] = Field(
        default=None, foreign_key="invoice_lines.id", nullable=True, ondelete="CASCADE"
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    product_references: List["ProductReference"] = Relationship(
        back_populates="referenced_item"
    )
    inventory_items: List["InventoryItem"] = Relationship(
        back_populates="referenced_item"
    )


class ProductReference(SQLModel, table=True):
    """
    Junction table: Product -> ReferencedItem (many-to-many).
    Tracks which raw expense lines compose a given product.
    """
    __tablename__ = "product_references"

    product_id: str = Field(
        foreign_key="products.id", primary_key=True, ondelete="CASCADE"
    )
    referenced_item_id: str = Field(
        foreign_key="referenced_items.id", primary_key=True, ondelete="CASCADE"
    )

    # Relationships
    product: Product = Relationship(back_populates="referenced_items")
    referenced_item: ReferencedItem = Relationship(back_populates="product_references")


# ---------------------------------------------------------------------------
# 5. Product Formats (how a product is purchased vs its base unit)
# ---------------------------------------------------------------------------

class ProductFormat(SQLModel, table=True):
    """
    A product can be bought in multiple purchase formats that map to a base unit.

    Example: "BATTACONE PANE CARASATU 400 GR"
      purchase_unit    = "ud"
      conversion_factor = 400
      base_unit         = "gr"
      => 1 ud = 400 gr

    Example: "OLIVE VERDI 5kg"
      purchase_unit    = "ud"
      conversion_factor = 5
      base_unit         = "kg"
      => 1 ud = 5 kg

    Matches Haddock inventory items API:
      pricePerUnit      -> price in BASE unit terms
      conversionFactor  -> purchase_unit * factor = base_unit quantity
    """
    __tablename__ = "product_formats"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: str = Field(
        foreign_key="products.id", index=True, ondelete="CASCADE"
    )

    purchase_unit: str              # e.g. "ud", "caja", "kg"
    conversion_factor: float        # qty in purchase_unit * factor = qty in base_unit
    base_unit: str                  # e.g. "kg", "l", "gr", "ud"
    base_unit_source: Optional[str] = Field(default=None)  # "manual" | "automatic"

    price_per_base_unit: Optional[float] = Field(default=None)

    # Optional supplier association for this specific format
    supplier_id: Optional[int] = Field(
        default=None, foreign_key="suppliers.id", nullable=True
    )
    # Haddock referenced item ID linked to this format
    haddock_referenced_id: Optional[str] = Field(
        default=None, foreign_key="referenced_items.id", nullable=True
    )

    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    product: Product = Relationship(back_populates="formats")


# ---------------------------------------------------------------------------
# 6. Inventory (a named inventory session / count event)
# ---------------------------------------------------------------------------

class Inventory(SQLModel, table=True):
    """
    An inventory session - a specific stock-count event.

    Haddock inventory ID: "inve~DBKwmF1ARmuqatOw9OTmoA"
    Each session captures warehouse quantities for all products/dishes
    at a point in time.

    Endpoint: GET /api/inventories/{inventory_id}/items
    """
    __tablename__ = "inventories"

    # Haddock external ID, e.g. "inve~DBKwmF1ARmuqatOw9OTmoA"
    id: str = Field(primary_key=True)
    name: Optional[str] = Field(default=None, index=True)
    inventory_date: Optional[datetime] = Field(default=None)
    status: str = Field(default="draft", index=True)  # draft | submitted | closed
    notes: Optional[str] = Field(default=None)
    created_by: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    items: List["InventoryItem"] = Relationship(
        back_populates="inventory", cascade_delete=True
    )


# ---------------------------------------------------------------------------
# 7. Inventory Item (one row per product/dish per inventory session)
# ---------------------------------------------------------------------------

class InventoryItem(SQLModel, table=True):
    """
    A single line in an inventory session.

    Supports two kinds (from Haddock API):
      kind = "product" -> links to Product via product_id / referenced_item_id
      kind = "dish"    -> links to a Recipe/Dish via dish_id

    Key fields from the inventory items API response:
      pricePerUnit        -> price per BASE unit (after conversion)
      conversionFactor    -> purchase_unit * factor = base_unit qty
      baseUnit            -> "kg", "l", "gr", "ud"
      warehouse.quantity  -> current stock in BASE units
      purchase.quantity   -> qty purchased this session (purchase units)
      purchase.unitOfMeasure -> purchase UoM (may differ from baseUnit)
      totalAccumulated    -> pricePerUnit * warehouse_quantity (cost)

    Note on multi-format products:
      The same productID can appear multiple times in one inventory session
      (one row per ReferencedItem/format). E.g. ALMIRANTE QUESO SEMICURADO
      appears twice: once as "kg" and once as "ud" format.
    """
    __tablename__ = "inventory_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    inventory_id: str = Field(
        foreign_key="inventories.id", index=True, ondelete="CASCADE"
    )

    # "product" or "dish"
    kind: str = Field(default="product", index=True)

    # Display name
    name: str

    # ── Product-specific links ──
    product_id: Optional[str] = Field(
        default=None, foreign_key="products.id", nullable=True, index=True
    )
    # The specific referenced item / format for this line
    referenced_item_id: Optional[str] = Field(
        default=None, foreign_key="referenced_items.id", nullable=True
    )

    # ── Dish-specific links ──
    # Haddock dish ID, e.g. "dish~uAw4rTQYRtOc_GRwXnLclw"
    dish_id: Optional[str] = Field(default=None, index=True, nullable=True)
    # Local recipe FK (if matched to our Recipe table)
    recipe_id: Optional[int] = Field(
        default=None, foreign_key="recipe.id", nullable=True
    )

    # ── Pricing & unit conversion ──
    price_per_unit: float = Field(default=0.0)        # Price per BASE unit
    conversion_factor: float = Field(default=1.0)     # purchase_unit * factor = base_unit
    base_unit: Optional[str] = Field(default=None)    # kg / l / gr / ud
    base_unit_source: Optional[str] = Field(default=None)  # manual | automatic

    # ── Warehouse / stock quantities ──
    warehouse_quantity: float = Field(default=0.0)    # Current stock in BASE units

    # ── Purchase quantities (what was bought in this session) ──
    purchase_quantity: float = Field(default=0.0)
    purchase_unit_of_measure: Optional[str] = Field(default=None)

    # ── Computed totals ──
    # price_per_unit * warehouse_quantity
    total_accumulated: float = Field(default=0.0)

    # Supplier for this line (products only)
    supplier_id: Optional[int] = Field(
        default=None, foreign_key="suppliers.id", nullable=True
    )
    haddock_supplier_id: Optional[str] = Field(default=None)  # "supp~…"

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    inventory: Inventory = Relationship(back_populates="items")
    product: Optional[Product] = Relationship(back_populates="inventory_items")
    referenced_item: Optional[ReferencedItem] = Relationship(
        back_populates="inventory_items"
    )

# ---------------------------------------------------------------------------
# 7. Product Alias
# ---------------------------------------------------------------------------

class ProductAlias(SQLModel, table=True):
    """
    Stores learned aliases for products (e.g. "Aloo" -> "Potato").
    """
    __tablename__ = "product_aliases"

    id: Optional[int] = Field(default=None, primary_key=True)
    alias_name: str = Field(index=True)
    master_product_id: str = Field(foreign_key="products.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
