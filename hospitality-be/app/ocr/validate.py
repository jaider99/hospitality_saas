"""
validate.py
============
Stage 3: after merging regex + LLM results, run completeness and arithmetic
checks. Anything that fails gets recorded in invoice.review_reasons and
invoice.needs_review = True, so it can be routed to your existing
"Request correction of an error in the document" workflow instead of being
silently trusted.
"""

from __future__ import annotations
from app.ocr.schema import Invoice

TOLERANCE = 0.02  # EUR cents tolerance for floating point / rounding noise

REQUIRED_FIELDS = [
    ("Document Number", lambda inv: inv.serialNumber),
    ("Date", lambda inv: inv.date),
    ("Supplier Name", lambda inv: inv.supplier.name),
    ("Supplier VAT ID", lambda inv: inv.supplier.vatID),
    ("Total Amount", lambda inv: inv.total if inv.total else None),
]


def check_required_fields(inv: Invoice) -> list:
    reasons = []
    for name, getter in REQUIRED_FIELDS:
        if not getter(inv):
            reasons.append(f"Missing {name}")
    return reasons


def check_totals_arithmetic(inv: Invoice) -> list:
    reasons = []
    if inv.subtotal is not None and inv.tax is not None and inv.total is not None:
        expected_total = (
            inv.subtotal
            + inv.tax
            - (inv.discount or 0)
            + (inv.payeAmount or 0)
            + (inv.greenPointAmount or 0)
            + (inv.ibeeAmount or 0)
            + (inv.taxableAdditionalCost or 0)
            - (inv.netAdditionalCost or 0)
        )
        if abs(expected_total - inv.total) > TOLERANCE and expected_total != 0:
            reasons.append(
                f"Invoice totals do not add up correctly (Calculated: €{expected_total:.2f}, Printed: €{inv.total:.2f})"
            )
    return reasons


def check_line_items_sum(inv: Invoice) -> list:
    reasons = []
    if not inv.items or not inv.subtotal:
        return reasons
    line_sum = sum(li.base for li in inv.items if li.base is not None)
    if abs(line_sum - inv.subtotal) > TOLERANCE and line_sum != 0:
        reasons.append(
            f"Line items sum (€{line_sum:.2f}) does not match Subtotal (€{inv.subtotal:.2f})"
        )
    return reasons

def fix_wrapped_quantities(inv: Invoice, tolerance: float = 0.05):
    """Back-solves the correct quantity if a wrapped digit was missed by the OCR/LLM."""
    if not inv.items:
        return
    for li in inv.items:
        if li.quantity and li.grossPrice and li.appliedDiscount is not None and li.base:
            expected_total_disc = li.quantity * li.grossPrice - li.appliedDiscount
            if abs(expected_total_disc - li.base) > tolerance:
                # solve for the quantity that WOULD make this match
                implied_qty = (li.base + li.appliedDiscount) / li.grossPrice
                if abs(implied_qty - round(implied_qty)) < 0.05:
                    li.quantity = round(implied_qty)

def check_line_item_internal_consistency(inv: Invoice) -> list:
    """quantity * (grossPrice - appliedDiscount) + otherFees ≈ base, per line.
    OR (for flat discounts): quantity * grossPrice - appliedDiscount + otherFees ≈ base."""
    reasons = []
    for i, li in enumerate(inv.items):
        if None in (li.quantity, li.grossPrice, li.base):
            continue
        
        expected_per_unit = li.quantity * (li.grossPrice - (li.appliedDiscount or 0)) + (li.otherFees or 0)
        expected_total_disc = li.quantity * li.grossPrice - (li.appliedDiscount or 0) + (li.otherFees or 0)
        
        if abs(expected_per_unit - li.base) <= TOLERANCE:
            continue
        elif abs(expected_total_disc - li.base) <= TOLERANCE:
            continue
            
        if li.nominalPrice is not None:
            expected_nom = li.quantity * li.nominalPrice + (li.otherFees or 0)
            if abs(expected_nom - li.base) <= TOLERANCE:
                continue
                
        if li.discountPct is not None:
            expected_pct = li.quantity * (li.grossPrice * (1 - li.discountPct / 100.0)) + (li.otherFees or 0)
            if abs(expected_pct - li.base) <= TOLERANCE:
                continue

        if expected_per_unit != 0 and expected_total_disc != 0:
             reasons.append(f"Line item {i+1} arithmetic is inconsistent")
    return reasons


def check_ocr_confidence(inv: Invoice, min_confidence: float = 70.0) -> list:
    # User requested to remove confidence score from review reasons entirely
    return []


def check_date_sanity(inv: Invoice, raw_text: str) -> list:
    """If raw text contains DD/MM/YY and parsed date's day doesn't match
    the first number in that pattern, the parse is likely wrong."""
    import re
    reasons = []
    m = re.search(r'\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b', raw_text)
    if m and inv.date:
        day_in_text = int(m.group(1))
        try:
            day_in_parsed = int(inv.date.split("-")[2])
            if day_in_text != day_in_parsed:
                reasons.append(f"Parsed date day does not match printed text")
        except Exception:
            pass
    return reasons


def check_quantity_verbatim(inv: Invoice, raw_text: str) -> list:
    reasons = []
    if not raw_text:
        return reasons
    for i, li in enumerate(inv.items):
        if li.quantity is None:
            continue
        qty_str = str(int(li.quantity)) if li.quantity == int(li.quantity) else str(li.quantity)
        if qty_str not in raw_text:
            reasons.append(f"Quantity '{qty_str}' for item {i+1} not found in text")
    return reasons


def sanity_check_discount(inv: Invoice) -> list:
    reasons = []
    if inv.discount and inv.discount > 0:
        for i, li in enumerate(inv.items):
            if li.discountPct == inv.discount:
                reasons.append(f"Discount value matches line item {i+1} percentage (possible misextraction)")
    return reasons


def validate(inv: Invoice, raw_text: str = "") -> Invoice:
    fix_wrapped_quantities(inv)
    reasons = list(inv.review_reasons) if inv.review_reasons else []
    reasons += check_required_fields(inv)
    reasons += check_totals_arithmetic(inv)
    reasons += check_line_items_sum(inv)
    reasons += check_line_item_internal_consistency(inv)
    reasons += check_ocr_confidence(inv)
    if raw_text:
        reasons += check_date_sanity(inv, raw_text)
        reasons += check_quantity_verbatim(inv, raw_text)
    reasons += sanity_check_discount(inv)

    inv.review_reasons = reasons
    inv.needs_review = len(reasons) > 0
    return inv
