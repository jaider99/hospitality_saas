"""
Pydantic / SQLModel schemas for Products & Inventory API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ---------------------------------------------------------------------------
# Category schemas
# ---------------------------------------------------------------------------

class CategoryBase(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    parent_id: Optional[str] = None


class CategoryRead(CategoryBase):
    parent: Optional["CategoryRead"] = None

    class Config:
        from_attributes = True

CategoryRead.model_rebuild()


# ---------------------------------------------------------------------------
# Manual Product Creation (from UI form)
# ---------------------------------------------------------------------------

class ProductManualCreate(BaseModel):
    """
    Payload for POST /products (manual creation).
    Maps to Haddock's 'Create product manually' form:
      - Basic info: name, product_code, supplier_ids, category_id
      - Purchases: price, unit_of_measure, shrinkage_pct
    """
    name: str = Field(..., min_length=1, description="Product display name")
    product_code: Optional[str] = Field(default=None, description="Optional SKU / product code")
    supplier_ids: List[int] = Field(default=[], description="Local DB supplier PKs to associate")
    # app_category_id links to our categories table (category_id field like CAT-XXXXXXXX)
    app_category_id: Optional[str] = Field(default=None, description="Our category ID (CAT-...)")
    # Legacy Haddock category (kept for backwards compat)
    category_id: Optional[str] = Field(default=None, description="Expense category ID (expcat~...)")
    # Purchases & recipe section
    price: Optional[float] = Field(default=None, ge=0, description="Price in euros")
    unit_of_measure: Optional[str] = Field(
        default="ud", description="Base unit: ud / kg / l / ml / gr"
    )
    shrinkage_pct: Optional[float] = Field(
        default=0.0, ge=0, le=100,
        description="Shrinkage percentage (part that cannot be used)"
    )
    tax_rate: Optional[float] = Field(
        default=None, description="IVA rate: 0, 0.04, 0.1 or 0.21"
    )


# ---------------------------------------------------------------------------
# Product Update (PATCH)
# ---------------------------------------------------------------------------

class ProductUpdate(BaseModel):
    """Partial update – all fields optional."""
    name: Optional[str] = None
    reference_price: Optional[float] = None
    unit_of_measure: Optional[str] = None
    tax_rate: Optional[float] = None
    category_id: Optional[str] = None          # legacy Haddock
    app_category_id: Optional[str] = None      # our categories table
    bookmarked: Optional[bool] = None
    archived: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Product List Row (matches the table columns in the UI)
# ---------------------------------------------------------------------------

class SupplierRef(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductListRow(BaseModel):
    """Single row in the product list table."""
    id: str
    name: str
    unit_of_measure: Optional[str] = None
    quantity: Optional[float] = None
    reference_price: Optional[float] = None
    last_price: Optional[float] = None
    total: float = 0.0
    price_difference_percentage: Optional[float] = None
    tax_rate: Optional[float] = None
    bookmarked: bool = False
    archived: bool = False
    merged: bool = False
    imported: bool = False
    # Legacy Haddock category
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    # Our app category (FK to categories table)
    app_category_id: Optional[str] = None
    app_category_name: Optional[str] = None
    app_category_color: Optional[str] = None
    suppliers: List[SupplierRef] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: List[ProductListRow]
    total: int
    skip: int
    limit: int
    pending_review_count: Optional[int] = None


# ---------------------------------------------------------------------------
# Product Detail
# ---------------------------------------------------------------------------

class PurchaseHistoryRow(BaseModel):
    """One row in the Purchases tab of a product detail view."""
    line_id: int
    invoice_id: int
    description: Optional[str] = None
    supplier_name: Optional[str] = None
    document_type: Optional[str] = None
    document_date: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    iva_pct: Optional[float] = None


class PriceStats(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    reference: Optional[float] = None
    last: Optional[float] = None


class ProductFormatRow(BaseModel):
    id: Optional[int] = None
    purchase_unit: str
    conversion_factor: float
    base_unit: str
    base_unit_source: Optional[str] = None
    price_per_base_unit: Optional[float] = None
    is_default: bool = False


class ProductDetail(BaseModel):
    """Full product detail — used for GET /products/{id}."""
    id: str
    name: str
    unit_of_measure: Optional[str] = None
    unit_of_measure_source: Optional[str] = None
    quantity: Optional[float] = None
    reference_price: Optional[float] = None
    last_price: Optional[float] = None
    total: float = 0.0
    price_difference_percentage: Optional[float] = None
    tax_rate: Optional[float] = None
    bookmarked: bool = False
    archived: bool = False
    merged: bool = False
    imported: bool = False
    config: Optional[Dict[str, Any]] = None
    category: Optional[CategoryRead] = None
    suppliers: List[Dict[str, Any]] = []
    formats: List[ProductFormatRow] = []
    price_stats: Optional[PriceStats] = None
    total_units_purchased: float = 0.0
    total_cost: float = 0.0
    purchase_history: List[PurchaseHistoryRow] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Review Queue — Pending Articles
# ---------------------------------------------------------------------------

class SimilarProductMatch(BaseModel):
    """A candidate existing product for unification suggestion."""
    product_id: str
    product_name: str
    unit_of_measure: Optional[str] = None
    last_price: Optional[float] = None
    confidence: str = "possibly_different"  # exact | possibly_different | looks_different


class ReviewQueueItem(BaseModel):
    """
    One unlinked invoice line in the review queue.
    Maps to Haddock's 'New articles pending review' list.
    """
    line_id: int
    invoice_id: int
    description: Optional[str] = None
    supplier_name: Optional[str] = None
    document_type: Optional[str] = None
    document_date: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    iva_pct: Optional[float] = None
    # Suggested existing products to unify with
    similar_products: List[SimilarProductMatch] = []


class ReviewQueueResponse(BaseModel):
    items: List[ReviewQueueItem]
    total: int
    skip: int
    limit: int


# ---------------------------------------------------------------------------
# Unify request
# ---------------------------------------------------------------------------

class UnifyRequest(BaseModel):
    """Request body for POST /products/review-queue/{line_id}/unify."""
    product_id: str = Field(..., description="Existing product ID to merge this line into (prod~...)")


# ---------------------------------------------------------------------------
# Inventory schemas (unchanged)
# ---------------------------------------------------------------------------

class InventoryBase(BaseModel):
    id: str
    name: Optional[str] = None
    inventory_date: Optional[datetime] = None
    status: str = "draft"
    notes: Optional[str] = None
    created_by: Optional[str] = None


class InventoryRead(InventoryBase):
    created_at: datetime
    updated_at: datetime
    item_count: Optional[int] = None

    class Config:
        from_attributes = True


class InventoryCreate(InventoryBase):
    pass


class InventoryItemRead(BaseModel):
    id: int
    inventory_id: str
    kind: str
    name: str
    product_id: Optional[str] = None
    referenced_item_id: Optional[str] = None
    dish_id: Optional[str] = None
    recipe_id: Optional[int] = None
    price_per_unit: float = 0.0
    conversion_factor: float = 1.0
    base_unit: Optional[str] = None
    base_unit_source: Optional[str] = None
    warehouse_quantity: float = 0.0
    purchase_quantity: float = 0.0
    purchase_unit_of_measure: Optional[str] = None
    total_accumulated: float = 0.0
    supplier_id: Optional[int] = None
    haddock_supplier_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryItemsResponse(BaseModel):
    items: List[InventoryItemRead]
    total: int


# ---------------------------------------------------------------------------
# Haddock API-shaped input (for bulk sync)
# ---------------------------------------------------------------------------

class HaddockSupplierRef(BaseModel):
    id: str
    name: str


class HaddockPurchase(BaseModel):
    quantity: float = 0.0
    unitOfMeasure: Optional[str] = None


class HaddockWarehouse(BaseModel):
    quantity: float = 0.0


class HaddockInventoryItemInput(BaseModel):
    kind: str
    name: str
    referencedID: Optional[str] = None
    productID: Optional[str] = None
    productName: Optional[str] = None
    supplier: Optional[HaddockSupplierRef] = None
    dishID: Optional[str] = None
    pricePerUnit: float = 0.0
    conversionFactor: float = 1.0
    baseUnit: Optional[str] = None
    baseUnitSource: Optional[str] = None
    totalAccumulated: float = 0.0
    purchase: HaddockPurchase = HaddockPurchase()
    warehouse: Optional[HaddockWarehouse] = None
    warehouseQuantity: Optional[float] = None
