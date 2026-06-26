"""
validate.py
============
Stage 3: after merging regex + LLM results, run completeness and arithmetic
checks. Anything that fails gets recorded in invoice.meta.review_reasons and
invoice.meta.needs_review = True, so it can be routed to your existing
"Request correction of an error in the document" workflow instead of being
silently trusted.
"""

from __future__ import annotations
from app.ocr.schema import OcrInvoice as Invoice

TOLERANCE = 0.02  # EUR cents tolerance for floating point / rounding noise

REQUIRED_FIELDS = [
    ("general_info.document_number", lambda inv: inv.general_info.document_number),
    ("general_info.date", lambda inv: inv.general_info.date),
    ("supplier.display_name", lambda inv: inv.supplier.display_name),
    ("supplier.tax_id", lambda inv: inv.supplier.tax_id),
    ("totals.total_with_iva", lambda inv: inv.totals.total_with_iva),
]


def check_required_fields(inv: Invoice) -> list:
    reasons = []
    for name, getter in REQUIRED_FIELDS:
        if getter(inv) is None:
            reasons.append(f"missing_required_field:{name}")
    return reasons


def check_totals_arithmetic(inv: Invoice) -> list:
    reasons = []
    t = inv.totals
    if t.base_amount is not None and t.iva_amount is not None and t.total_with_iva is not None:
        expected_total = (
            t.base_amount
            + t.iva_amount
            - (t.discount or 0)
            + (t.paye or 0)
            + (t.green_point or 0)
            + (t.ibee or 0)
            + (t.attributable_cost or 0)
            - (t.tax_free_costs or 0)
        )
        if abs(expected_total - t.total_with_iva) > TOLERANCE:
            reasons.append(
                f"totals_mismatch: base+iva+adjustments={expected_total:.2f} "
                f"!= total_with_iva={t.total_with_iva:.2f}"
            )
    return reasons


def check_line_items_sum(inv: Invoice) -> list:
    reasons = []
    if not inv.line_items or inv.totals.base_amount is None:
        return reasons
    line_sum = sum(li.base for li in inv.line_items if li.base is not None)
    if abs(line_sum - inv.totals.base_amount) > TOLERANCE:
        reasons.append(
            f"line_items_base_sum_mismatch: sum={line_sum:.2f} "
            f"!= totals.base_amount={inv.totals.base_amount:.2f}"
        )
    return reasons


def check_line_item_internal_consistency(inv: Invoice) -> list:
    """quantity * (gross_price - applied_discount) + other_fees ≈ base, per line."""
    reasons = []
    for i, li in enumerate(inv.line_items):
        if None in (li.quantity, li.gross_price, li.base):
            continue
        expected = li.quantity * (li.gross_price - (li.applied_discount or 0)) + (li.other_fees or 0)
        if abs(expected - li.base) > TOLERANCE:
            reasons.append(f"line_item_{i}_inconsistent: expected_base={expected:.2f} != base={li.base:.2f}")
    return reasons


def check_ocr_confidence(inv: Invoice, min_confidence: float = 70.0) -> list:
    reasons = []
    conf = inv.meta.ocr_confidence
    if conf is not None and conf < min_confidence:
        reasons.append(f"low_ocr_confidence:{conf:.1f}")
    return reasons


def validate(inv: Invoice) -> Invoice:
    reasons = []
    reasons += check_required_fields(inv)
    reasons += check_totals_arithmetic(inv)
    reasons += check_line_items_sum(inv)
    reasons += check_line_item_internal_consistency(inv)
    reasons += check_ocr_confidence(inv)

    inv.meta.review_reasons = reasons
    inv.meta.needs_review = len(reasons) > 0
    return inv
