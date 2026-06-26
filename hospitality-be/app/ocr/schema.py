"""
schema.py
=========
Canonical, language-agnostic data model for invoice extraction.

Every field here was taken directly from the three reference screenshots:
  - Image 1: General information / Supplier / Reconciliation / Payment
  - Image 2: Totals breakdown
  - Image 3: Line items table

Both OCR+regex and the LLM fallback must populate fields named EXACTLY like
this. This is the single source of truth for "what counts as a complete
extraction."

Ported from OCR_invoice into hospitality-be/app/ocr/
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional, List
import json
import re


@dataclass
class Supplier:
    display_name: Optional[str] = None        # e.g. "BACKSTAGE GESTIÓN"
    legal_name: Optional[str] = None           # e.g. "Backstage Gestion TAP 2026, S.L."
    tax_id: Optional[str] = None               # CIF/NIF/VAT number e.g. "B25915679"
    address: Optional[str] = None
    contact_count: Optional[int] = None        # "1 contact"


@dataclass
class GeneralInfo:
    document_type: Optional[str] = None        # Invoice / Credit note / Receipt ...
    document_number: Optional[str] = None      # "2485/26"
    date: Optional[str] = None                 # normalized ISO "2026-02-06"
    category: Optional[str] = None             # "Others"
    uploaded_by: Optional[str] = None           # email


@dataclass
class LineItem:
    provider_code: Optional[str] = None
    product: Optional[str] = None              # description
    quantity: Optional[float] = None
    unit: Optional[str] = None                 # "unit", "kg", "hour" ...
    gross_price: Optional[float] = None
    discount_pct: Optional[float] = None       # "Discounts" column (%)
    applied_discount: Optional[float] = None   # absolute € value
    other_fees: Optional[float] = None
    nominal_price: Optional[float] = None
    iva_pct: Optional[float] = None            # VAT/IVA rate %
    base: Optional[float] = None               # line base amount


@dataclass
class IVABreakdownRow:
    """One row of the per-rate IVA breakdown table (common on Spanish invoices)."""
    rate_pct: Optional[float] = None     # e.g. 4.0, 10.0, 21.0
    base: Optional[float] = None          # taxable base for this rate
    iva_amount: Optional[float] = None   # tax for this rate
    row_total: Optional[float] = None    # base + iva for this rate


@dataclass
class Totals:
    base_amount: Optional[float] = None
    iva_amount: Optional[float] = None
    discount: Optional[float] = None
    paye: Optional[float] = None
    green_point: Optional[float] = None
    ibee: Optional[float] = None
    attributable_cost: Optional[float] = None
    tax_free_costs: Optional[float] = None
    total_with_iva: Optional[float] = None
    iva_breakdown: List["IVABreakdownRow"] = field(default_factory=list)


@dataclass
class StatusInfo:
    reconciliation_status: Optional[str] = None   # "Unreconciled" / "Reconciled"
    payment_status: Optional[str] = None          # "Unpaid" / "Paid"


@dataclass
class ExtractionMeta:
    source_file: Optional[str] = None
    language_detected: Optional[str] = None        # "en" / "es"
    extraction_method: Optional[str] = None        # "regex" / "llm" / "hybrid"
    ocr_confidence: Optional[float] = None          # 0-100, average OCR conf
    needs_review: bool = False
    review_reasons: List[str] = field(default_factory=list)


@dataclass
class OcrInvoice:
    general_info: GeneralInfo = field(default_factory=GeneralInfo)
    supplier: Supplier = field(default_factory=Supplier)
    line_items: List[LineItem] = field(default_factory=list)
    totals: Totals = field(default_factory=Totals)
    status: StatusInfo = field(default_factory=StatusInfo)
    currency: str = "EUR"
    meta: ExtractionMeta = field(default_factory=ExtractionMeta)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Bilingual label dictionary used by BOTH the regex stage and the LLM prompt.
# ---------------------------------------------------------------------------
LABELS = {
    "document_type":   ["invoice", "factura", "credit note", "nota de credito", "receipt", "recibo"],
    "document_number": ["invoice number", "document number", "nº factura", "no. factura",
                         "factura n", "nº documento", "num. factura", "documento número", "documento numero",
                         "nota de pago", "comprobante", "nº:", "n°:", "nº", "n°", "albarán", "albaran", "pedido", "document:"],
    "date":            ["date", "fecha", "fecha factura", "invoice date", "data"],
    "category":        ["category", "categoria"],
    "uploaded_by":     ["uploaded by", "subido por"],
    "supplier_name":   ["supplier", "proveedor", "emisor", "vendedor", "vendor", "seller"],
    "tax_id":          ["cif", "nif", "vat", "tax id", "n.i.f", "c.i.f", "vat number", "vat no", "vat reg"],
    "base_amount":     ["base imponible", "base imp.", "base imp", "base amount", "net amount", "subtotal", "taxable amount", "taxable base"],
    "iva_amount":      ["iva amount", "vat amount", "cuota iva", "importe iva", "tax amount", "vat", "iva", "tax"],
    "discount":        ["discount", "descuento"],
    "paye":            ["irpf", "recargo de equivalencia", "retencion", "retención"],
    "green_point":     ["green point", "punto verde"],
    "ibee":            ["ibee"],
    "attributable_cost": ["attributable cost", "coste imputable"],
    "tax_free_costs":  ["tax free costs", "gastos exentos", "exempt"],
    "total_with_iva":  ["p. pagados", "pagados", "total a pagar", "importe a pagar",
                         "total", "total amount", "importe total", "total (with iva)",
                         "total con iva", "límite de pago", "total due", "amount due", "grand total"],
    "reconciliation_status": ["reconciliation", "reconciliado", "conciliacion"],
    "payment_status":  ["payment", "pago", "estado de pago", "status"],
}

LINE_ITEM_HEADERS = {
    "provider_code":   ["provider code", "codigo proveedor"],
    "product":         ["product", "producto", "descripcion", "description", "concepto"],
    "quantity":        ["quantity", "cantidad"],
    "unit":            ["unit", "unidad"],
    "gross_price":     ["gross price", "precio bruto"],
    "discount_pct":    ["discounts", "descuentos"],
    "applied_discount": ["applied discount", "descuento aplicado"],
    "other_fees":      ["other fees", "otros gastos"],
    "nominal_price":   ["nominal price", "precio nominal"],
    "iva_pct":         ["iva", "vat"],
    "base":            ["base"],
}


def clean_extracted_text(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    # Strip markdown symbols like #, *, _, `
    val = re.sub(r'[#*_`]', '', val)
    # Strip leading/trailing whitespaces, colons, dashes, commas
    val = val.strip().strip(":- ,. \t\n\r")
    
    # Strip common label prefixes case-insensitively
    prefix_pattern = r'^(supplier name|supplier|proveedor|emisor|vendor|vendedor|seller|customer name|customer|cliente|client|buyer|comprador|invoice number|invoice no|invoice num|invoice|factura número|factura numero|factura nº|factura n°|factura n|factura|document number|document no|document num|document|documento número|documento numero|documento nº|documento n°|documento n|documento)\s*[:\-\s]+'
    val = re.sub(prefix_pattern, '', val, flags=re.IGNORECASE)
    
    # Strip again after prefix removal
    val = val.strip().strip(":- ,. \t\n\r")
    
    val_lower = val.lower()
    labels_to_ignore = {
        "supplier", "proveedor", "emisor", "vendor", "vendedor", "seller",
        "customer", "cliente", "client", "buyer", "comprador", "factura",
        "invoice", "albaran", "delivery note", "ticket", "receipt", "recibo",
        "date", "fecha", "tax id", "vat id", "nif", "cif", "c.i.f.", "n.i.f.",
        "subtotal", "total", "base imponible", "document", "documento"
    }
    if val_lower in labels_to_ignore or len(val) < 2:
        return None
    return val
