from sqlmodel import SQLModel, Field, Relationship, Column, JSON
from datetime import datetime
from typing import Optional, List, Dict, Any


class SupplierContact(SQLModel, table=True):
    __tablename__ = "supplier_contacts"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_id: int = Field(foreign_key="suppliers.id", ondelete="CASCADE")
    name: str
    position: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    contact_preference: Optional[str] = Field(default=None)
    is_main_contact: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    supplier: "Supplier" = Relationship(back_populates="contact_list")

class Supplier(SQLModel, table=True):
    __tablename__ = "suppliers"  # Use snake_case plural to match migrations
    
    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: Optional[int] = Field(default=None, foreign_key="restaurant.id", index=True)
    supplier_code: Optional[str] = Field(default=None, index=True)
    name: str = Field(index=True)
    legal_name: Optional[str] = Field(default=None)        # legalName from OCR schema
    vat_id: Optional[str] = Field(default=None, index=True)  # CIF/NIF/VAT from OCR schema
    address: Optional[str] = Field(default=None)
    category_id: Optional[str] = Field(default=None, foreign_key="categories.category_id", index=True)
    accounting_account: Optional[str] = Field(default=None)
    sanitary_registration: Optional[str] = Field(default=None)
    tags: List[str] = Field(default=[], sa_column=Column(JSON))
    payment_info: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    notes: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))

    contacts_count: int = Field(default=0)
    contact_info: Optional[str] = Field(default=None)      # Phone, email, etc.
    contact_name: Optional[str] = Field(default=None)      # Main contact person name
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    contact_list: List["SupplierContact"] = Relationship(back_populates="supplier", cascade_delete=True)
    products: List["SuppliedProduct"] = Relationship(back_populates="supplier", cascade_delete=True)
    invoices: List["Invoice"] = Relationship(back_populates="supplier", cascade_delete=True)
    category: Optional["Category"] = Relationship(back_populates="suppliers")

class SuppliedProduct(SQLModel, table=True):
    __tablename__ = "suppliedproduct"  # Match migration naming
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    sku: Optional[str] = Field(default=None, unique=True, index=True)
    supplier_id: int = Field(foreign_key="suppliers.id", ondelete="CASCADE")
    current_price: float = Field(default=0.0)
    unit: str  # e.g., "kg", "litre", "case", "bottle"
    product_type: Optional[str] = Field(default=None)  # Category like "Food", "Beverage", "Equipment"
    category: Optional[str] = Field(default=None)  # Additional categorization
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    supplier: Supplier = Relationship(back_populates="products")
    cost_history: List["ProductCostHistory"] = Relationship(back_populates="product", cascade_delete=True)
    invoice_lines: List["InvoiceLine"] = Relationship(back_populates="product_rel")
    recipe_ingredients: List["RecipeIngredient"] = Relationship(
        back_populates="product",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class ProductCostHistory(SQLModel, table=True):
    __tablename__ = "productcosthistory"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="suppliedproduct.id", ondelete="CASCADE")
    price: float = Field(default=0.0)
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    product: SuppliedProduct = Relationship(back_populates="cost_history")

class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"  # Use exact migration name
    
    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: Optional[int] = Field(default=None, foreign_key="restaurant.id", index=True)
    invoice_number: Optional[str] = Field(default=None, index=True, nullable=True)
    supplier_id: Optional[int] = Field(default=None, foreign_key="suppliers.id", ondelete="CASCADE", nullable=True)
    issue_date: Optional[datetime] = Field(default=None, nullable=True)
    total_amount: float = Field(default=0.0)
    status: str = Field(default="PENDING")  # PENDING, PROCESSED, FAILED
    raw_text: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = Field(default=None)
    is_refund: bool = Field(default=False)
    is_recurrent: bool = Field(default=False)
    is_duplicate: bool = Field(default=False)

    # --- OCR-extracted fields (populated by background worker) ---
    # General info
    document_type: Optional[str] = Field(default=None)       # Invoice / Credit note / Receipt
    document_number: Optional[str] = Field(default=None)     # OCR-extracted doc number
    document_date: Optional[str] = Field(default=None)       # ISO date string "YYYY-MM-DD"
    category: Optional[str] = Field(default=None)
    uploaded_by: Optional[str] = Field(default=None)

    # Supplier (denormalized OCR output — may differ from FK supplier)
    supplier_display_name: Optional[str] = Field(default=None)
    supplier_legal_name: Optional[str] = Field(default=None)
    supplier_tax_id: Optional[str] = Field(default=None, index=True)
    supplier_address: Optional[str] = Field(default=None)
    supplier_contact_count: Optional[int] = Field(default=None)
    supplier_contact_info: Optional[str] = Field(default=None)  # Denormalized contact info

    # Totals
    base_amount: Optional[float] = Field(default=None)
    iva_amount: Optional[float] = Field(default=None)
    discount: Optional[float] = Field(default=None)
    paye: Optional[float] = Field(default=None)
    green_point: Optional[float] = Field(default=None)
    ibee: Optional[float] = Field(default=None)
    attributable_cost: Optional[float] = Field(default=None)
    tax_free_costs: Optional[float] = Field(default=None)
    total_with_iva: Optional[float] = Field(default=None)

    # Extraction confidence metrics
    ocr_confidence: Optional[float] = Field(default=None)
    llm_confidence: Optional[float] = Field(default=None)

    # Status from invoice document
    reconciliation_status: Optional[str] = Field(default=None)  # Unreconciled / Reconciled
    payment_status: Optional[str] = Field(default=None)         # Unpaid / Paid
    currency: str = Field(default="EUR")

    # OCR pipeline metadata
    source_file: Optional[str] = Field(default=None)             # MinIO object key
    file_url: Optional[str] = Field(default=None)                # Full public MinIO URL
    language_detected: Optional[str] = Field(default=None)      # en / es
    extraction_method: Optional[str] = Field(default=None)      # regex / llm / hybrid
    ocr_confidence: Optional[float] = Field(default=None)       # 0-100
    needs_review: bool = Field(default=False, index=True)
    review_reasons: Optional[str] = Field(default=None)         # JSON list as string
    ocr_duration: Optional[float] = Field(default=None)          # Time taken for OCR processing
    llm_duration: Optional[float] = Field(default=None)          # Time taken for LLM extraction

    @property
    def ocr_time(self) -> Optional[float]:
        return self.ocr_duration

    @ocr_time.setter
    def ocr_time(self, value: Optional[float]):
        self.ocr_duration = value

    @property
    def llm_time(self) -> Optional[float]:
        return self.llm_duration

    @llm_time.setter
    def llm_time(self, value: Optional[float]):
        self.llm_duration = value

    # Full raw OCR JSON (future-proof, never loses data)
    raw_ocr_json: Optional[str] = Field(default=None)


    # Relationships
    supplier: Supplier = Relationship(back_populates="invoices")
    lines: List["InvoiceLine"] = Relationship(back_populates="invoice", cascade_delete=True)
    tax_brackets: List["InvoiceTaxBracket"] = Relationship(back_populates="invoice", cascade_delete=True)

class InvoiceLine(SQLModel, table=True):
    __tablename__ = "invoice_lines"  # Match migration
    
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoices.id", ondelete="CASCADE")
    description: str = Field(default="")
    quantity: float = Field(default=0.0)
    unit_price: float = Field(default=0.0)
    total_price: float = Field(default=0.0)
    product_id: Optional[int] = Field(default=None, foreign_key="suppliedproduct.id", ondelete="SET NULL")

    # --- OCR-extracted line item fields ---
    provider_code: Optional[str] = Field(default=None)
    product: Optional[str] = Field(default=None)                # OCR-extracted product description/name
    product_type: Optional[str] = Field(default=None)           # Product type/category
    unit: Optional[str] = Field(default=None)                  # kg, unit, hour ...
    gross_price: Optional[float] = Field(default=None)
    discount_pct: Optional[float] = Field(default=None)        # discount %
    applied_discount: Optional[float] = Field(default=None)    # absolute discount amount
    other_fees: Optional[float] = Field(default=None)
    nominal_price: Optional[float] = Field(default=None)
    iva_pct: Optional[float] = Field(default=None)             # VAT/IVA rate %
    base: Optional[float] = Field(default=None)                # line base amount (pre-tax)
    gra: Optional[float] = Field(default=None)
    u_m: Optional[float] = Field(default=None)
    deleted_at: Optional[datetime] = Field(default=None)

    # --- AI Suggested Match fields ---
    suggested_product_id: Optional[str] = Field(default=None)
    suggested_confidence: Optional[int] = Field(default=None)

    # Relationships
    invoice: Invoice = Relationship(back_populates="lines")
    product_rel: Optional[SuppliedProduct] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "InvoiceLine.product_id==SuppliedProduct.id", "back_populates": "invoice_lines"}
    )


class InvoiceTaxBracket(SQLModel, table=True):
    """Per-rate IVA breakdown row — matches TaxBracketRecord in OCR_invoice/storage.py."""
    __tablename__ = "invoicetaxbracket"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoices.id", ondelete="CASCADE")
    rate_pct: Optional[float] = Field(default=None)          # e.g. 4.0, 10.0, 21.0
    base: Optional[float] = Field(default=None)               # taxable base for this rate
    iva_amount: Optional[float] = Field(default=None)         # tax for this rate
    row_total: Optional[float] = Field(default=None)          # base + iva for this rate
    equivalence_surcharge_rate: Optional[float] = Field(default=None)
    equivalence_surcharge: Optional[float] = Field(default=None)
    deleted_at: Optional[datetime] = Field(default=None)

    # Relationships
    invoice: Invoice = Relationship(back_populates="tax_brackets")


# Resolve circular dependencies for relationships
from app.module.recipes.model import RecipeIngredient
from app.module.categories.model import Category
