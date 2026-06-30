"""
schema.py
=========
Canonical, language-agnostic data model for invoice extraction based on Haddock schema.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional, List
import json


@dataclass
class Supplier:
    id: Optional[str] = None
    name: Optional[str] = None
    legalName: Optional[str] = None
    vatID: Optional[str] = None
    address: Optional[str] = None
    contacts: int = 0
    contactInfo: Optional[str] = None


@dataclass
class TaxBracket:
    id: Optional[int] = None
    subtotal: Optional[float] = None
    taxRate: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    equivalenceSurchargeRate: Optional[float] = None # IS (%)
    equivalenceSurcharge: Optional[float] = None     # ES (€)


@dataclass
class PaymentInfo:
    paidStatus: Optional[str] = None
    dueDate: Optional[str] = None
    method: Optional[str] = None


@dataclass
class LineItem:
    id: Optional[int] = None
    providerCode: Optional[str] = None
    product: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    grossPrice: Optional[float] = None
    discountPct: Optional[float] = None
    appliedDiscount: Optional[float] = None
    otherFees: Optional[float] = None
    nominalPrice: Optional[float] = None
    totalPrice: Optional[float] = None
    # For compatibility with some extraction modules that might set these:
    iva_pct: Optional[float] = None
    base: Optional[float] = None


@dataclass
class DocumentMeta:
    id: Optional[str] = None
    pdfURL: Optional[str] = None
    thumbnailJPEGURL: Optional[str] = None
    thumbnailWEBPURL: Optional[str] = None
    placeholderURL: Optional[str] = None
    fileUrl: Optional[str] = None # For MinIO URL


@dataclass
class Invoice:
    id: Optional[str] = None
    supplierID: Optional[str] = None
    supplierName: Optional[str] = None
    uploaderID: Optional[str] = None
    propertyID: Optional[str] = None
    categoryID: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None
    type: str = "invoice"
    ocrStatus: str = "processed"
    documentID: Optional[str] = None
    isRefund: bool = False
    paidStatus: str = "unpaid"
    dueDate: Optional[str] = None
    date: Optional[str] = None
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    discount: float = 0.0
    taxableAdditionalCost: float = 0.0
    netAdditionalCost: float = 0.0
    payeAmount: float = 0.0
    greenPointAmount: float = 0.0
    ibeeAmount: float = 0.0
    serialNumber: Optional[str] = None
    taxBrackets: List[TaxBracket] = field(default_factory=list)
    isReconciled: bool = False
    documentInboxEmail: Optional[str] = None
    observations: Optional[str] = None
    
    supplier: Supplier = field(default_factory=Supplier)
    payment: PaymentInfo = field(default_factory=PaymentInfo)
    document: DocumentMeta = field(default_factory=DocumentMeta)
    items: List[LineItem] = field(default_factory=list)

    # Adding a place for confidence and review notes so pipeline can still use them
    ocr_confidence: Optional[float] = None
    needs_review: bool = False
    review_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Bilingual label dictionary used by BOTH the regex stage and the LLM prompt.
# ---------------------------------------------------------------------------
LABELS = {
    "type":            ["invoice", "factura", "credit note", "nota de credito", "receipt", "recibo", "albarán", "albaran", "albarán copia", "delivery note", "nota de entrega", "ticket", "orden de compra"],
    "serialNumber":    ["factura:", "n\u00ba factura:", "factura n\u00ba", "factura no.", "factura num", "n\u00ba albar\u00e1n", "number:", "number", "invoice number", "document number", "n\u00ba factura", "no. factura",
                         "factura n", "n\u00ba documento", "num. factura", "documento n\u00famero", "documento numero",
                         "nota de pago", "comprobante", "n\u00ba:", "n\u00b0:", "n\u00ba", "n\u00b0", "document:", "albar\u00e1n", "albaran", "pedido"],
    "date":            ["date", "fecha", "fecha factura", "invoice date", "data"],
    "categoryID":      ["category", "categoria"],
    "uploaderID":      ["uploaded by", "subido por"],
    "supplierName":    ["supplier", "proveedor", "emisor", "vendedor", "vendor", "seller"],
    "vatID":           ["cif", "nif", "vat", "tax id", "n.i.f", "c.i.f", "vat number", "vat no", "vat reg"],
    "subtotal":        ["base imponible", "base imp.", "base imp", "base amount", "net amount", "subtotal", "taxable amount", "taxable base"],
    "tax":             ["iva amount", "vat amount", "cuota iva", "importe iva", "tax amount", "vat", "iva", "tax"],
    "discount":        ["discount", "descuento"],
    "payeAmount":      ["irpf", "recargo de equivalencia", "retencion", "retención"],
    "greenPointAmount":["green point", "punto verde"],
    "ibeeAmount":      ["ibee"],
    "taxableAdditionalCost": ["attributable cost", "coste imputable"],
    "netAdditionalCost":  ["tax free costs", "gastos exentos", "exempt"],
    "total":           ["p. pagados", "pagados", "pagado", "total a pagar", "importe a pagar",
                         "total", "total amount", "importe total", "total (with iva)",
                         "total con iva", "límite de pago", "total due", "amount due", "grand total"],
    "isReconciled":    ["reconciliation", "reconciliado", "conciliacion"],
    "paidStatus":      ["payment", "pago", "estado de pago", "status"],
}

LINE_ITEM_HEADERS = {
    "providerCode":    ["provider code", "codigo proveedor"],
    "product":         ["product", "producto", "descripcion", "description", "concepto"],
    "quantity":        ["quantity", "cantidad"],
    "unit":            ["unit", "unidad"],
    "grossPrice":      ["gross price", "precio bruto"],
    "discountPct":     ["discounts", "descuentos"],
    "appliedDiscount": ["applied discount", "descuento aplicado"],
    "otherFees":       ["other fees", "otros gastos"],
    "nominalPrice":    ["nominal price", "precio nominal"],
    "iva_pct":         ["iva", "vat"],
    "base":            ["base"],
}
