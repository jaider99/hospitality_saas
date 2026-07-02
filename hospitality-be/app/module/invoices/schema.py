from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class SupplierBase(BaseModel):
    id: int
    name: str
    vat_id: Optional[str] = None
    legal_name: Optional[str] = None
    address: Optional[str] = None
    contact_info: Optional[str] = None
    contact_name: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    id: int
    invoice_number: Optional[str] = None
    document_number: Optional[str] = None         # OCR-extracted doc number
    document_type: Optional[str] = None
    document_date: Optional[str] = None           # ISO date from invoice
    supplier_id: Optional[int] = None
    supplier_display_name: Optional[str] = None   # OCR supplier name
    supplier_tax_id: Optional[str] = None
    issue_date: Optional[datetime] = None
    total_amount: float = 0.0
    status: str
    supplier: Optional[SupplierBase] = None
    lines_count: int = 0
    payment_status: Optional[str] = None          # Unpaid / Paid
    reconciliation_status: Optional[str] = None   # Unreconciled / Reconciled
    needs_review: bool = False
    ocr_confidence: Optional[float] = None
    llm_confidence: Optional[float] = None
    extraction_method: Optional[str] = None
    currency: str = "EUR"

    # New fields replicated from OCR_invoice
    supplier_contact_count: Optional[int] = None
    green_point: Optional[float] = None
    ibee: Optional[float] = None
    attributable_cost: Optional[float] = None
    tax_free_costs: Optional[float] = None
    source_file: Optional[str] = None
    review_reasons: Optional[str] = None          # JSON list stored as string
    ocr_time: Optional[float] = None
    llm_time: Optional[float] = None
    ocr_duration: Optional[float] = None
    llm_duration: Optional[float] = None
    is_duplicate: Optional[bool] = False


    class Config:
        from_attributes = True
        populate_by_name = True


class InvoiceStatusResponse(BaseModel):
    """Lightweight response for the polling endpoint."""
    id: int
    status: str                               # PENDING | PROCESSED | FAILED
    needs_review: bool = False
    invoice_number: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_tax_id: Optional[str] = None
    total_amount: Optional[float] = None
    extraction_method: Optional[str] = None
    ocr_confidence: Optional[float] = None
    llm_confidence: Optional[float] = None
    ocr_duration: Optional[float] = None
    llm_duration: Optional[float] = None

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    current_price: float
    unit: str

    class Config:
        from_attributes = True


class InvoiceLineDetails(BaseModel):
    id: int
    invoice_id: int
    description: str
    quantity: float
    unit_price: float
    total_price: float
    product_id: Optional[int] = None
    product: Optional[ProductBase] = Field(default=None, validation_alias="product_rel")
    # OCR fields
    provider_code: Optional[str] = None
    product_name: Optional[str] = Field(default=None, validation_alias="product")   # OCR product name string
    product_type: Optional[str] = None                                               # Product type/category
    unit: Optional[str] = None
    gross_price: Optional[float] = None
    discount_pct: Optional[float] = None
    applied_discount: Optional[float] = None
    other_fees: Optional[float] = None
    nominal_price: Optional[float] = None
    iva_pct: Optional[float] = None
    base: Optional[float] = None
    gra: Optional[float] = None
    u_m: Optional[float] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class InvoiceTaxBracketResponse(BaseModel):
    id: int
    invoice_id: int
    rate_pct: Optional[float] = None
    base: Optional[float] = None
    iva_amount: Optional[float] = None
    row_total: Optional[float] = None
    equivalence_surcharge_rate: Optional[float] = None
    equivalence_surcharge: Optional[float] = None

    class Config:
        from_attributes = True


class InvoiceDetailsResponse(BaseModel):
    id: int
    invoice_number: Optional[str] = None
    document_number: Optional[str] = None
    document_type: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_display_name: Optional[str] = None  # OCR-extracted supplier name
    supplier_legal_name: Optional[str] = None    # OCR-extracted supplier legal name
    supplier_tax_id: Optional[str] = None
    supplier_address: Optional[str] = None       # OCR-extracted supplier address
    supplier_contact_info: Optional[str] = None  # OCR-extracted supplier contact info
    issue_date: Optional[datetime] = None
    total_amount: float = 0.0
    status: str
    is_duplicate: Optional[bool] = False
    supplier: Optional[SupplierBase] = None
    lines: List[InvoiceLineDetails] = []
    tax_brackets: List[InvoiceTaxBracketResponse] = []
    payment_status: Optional[str] = None
    reconciliation_status: Optional[str] = None
    needs_review: bool = False
    ocr_confidence: Optional[float] = None
    llm_confidence: Optional[float] = None
    extraction_method: Optional[str] = None

    # New fields replicated from OCR_invoice
    supplier_contact_count: Optional[int] = None
    green_point: Optional[float] = None
    ibee: Optional[float] = None
    attributable_cost: Optional[float] = None
    tax_free_costs: Optional[float] = None
    source_file: Optional[str] = None
    review_reasons: Optional[str] = None
    ocr_time: Optional[float] = None
    llm_time: Optional[float] = None
    ocr_duration: Optional[float] = None
    llm_duration: Optional[float] = None
    is_duplicate: Optional[bool] = None
    
    # Missing totals
    discount: Optional[float] = None
    paye: Optional[float] = None
    base_amount: Optional[float] = None
    iva_amount: Optional[float] = None
    total_with_iva: Optional[float] = None

    class Config:
        from_attributes = True


class InvoiceLineUploadResponse(BaseModel):
    id: int
    invoice_id: int
    description: str
    quantity: float
    unit_price: float
    total_price: float
    product_id: int
    sku: Optional[str] = None
    price_increased: bool
    increase_pct: float


class InvoiceUploadResponse(BaseModel):
    invoiceId: int
    invoiceNumber: Optional[str] = None
    supplierName: Optional[str] = None
    totalAmount: float = 0.0
    linesCount: int = 0
    lines: List[InvoiceLineUploadResponse] = []
