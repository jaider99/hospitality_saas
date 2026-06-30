# """
# pipeline.py
# ============
# Main orchestrator for invoice processing using the full developer blueprint.
# """

# from __future__ import annotations
# import logging
# import re
# from dotenv import load_dotenv

# load_dotenv()

# from app.ocr.schema import Invoice
# from app.ocr.ingest import ingest, build_invoice_markdown
# from app.ocr.regex_extract import extract_with_regex
# from app.ocr.table_extract import extract_line_items
# from app.ocr.llm_fallback import extract_with_llm, merge_llm_result_into_invoice
# from app.ocr.validate import validate, REQUIRED_FIELDS

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger("invoice_pipeline")

# OCR_CONFIDENCE_THRESHOLD = 70.0


# def _missing_required_field_names(inv: Invoice) -> list:
#     return [name for name, getter in REQUIRED_FIELDS if not getter(inv)]


# def _needs_llm_fallback(inv: Invoice) -> bool:
#     if _missing_required_field_names(inv):
#         return True
#     if inv.ocr_confidence is not None and inv.ocr_confidence < OCR_CONFIDENCE_THRESHOLD:
#         return True
#     if not inv.items:
#         return True
#     return False


# def process_invoice(file_path: str, save_to_db: bool = True, base_name: str = "") -> Invoice:
#     logger.info(f"Processing: {file_path}")

#     # --- Stage 0: ingest ---
#     page_result = ingest(file_path)
#     logger.info(f"OCR/text extraction done. avg_confidence={page_result.avg_confidence:.1f}")

#     import os
#     md_outputs_dir = os.path.join(os.getcwd(), "ocr_results")
#     os.makedirs(md_outputs_dir, exist_ok=True)
#     if not base_name:
#         base_name = os.path.splitext(os.path.basename(file_path))[0]
#     md_path = os.path.join(md_outputs_dir, f"{base_name}_ocr.md")

#     from app.ocr.llm_fallback import format_ocr_markdown_with_llm
    
#     if page_result.is_native_text:
#         raw_md = f"# Invoice (Native Text)\n\n{page_result.raw_text}"
#     else:
#         raw_md = f"# Invoice (Scanned OCR)\n\n{page_result.raw_text}"
        
#     structured_md = format_ocr_markdown_with_llm(raw_md)

#     try:
#         with open(md_path, "w", encoding="utf-8") as f:
#             f.write(structured_md)
#     except Exception as e:
#         logger.warning(f"Could not save markdown: {e}")

#     ocr_text = structured_md

#     # --- Stage 1: Fast deterministic Regex ---
#     inv = extract_with_regex(ocr_text)
#     # Using document meta for source file temporarily
#     inv.ocr_confidence = page_result.avg_confidence

#     if not inv.items:
#         try:
#             items = extract_line_items(
#                 file_path,
#                 page_result.is_native_text,
#                 page_result.page_images[0] if page_result.page_images else None
#             )
#             if items:
#                 inv.items = items
#                 logger.info(f"Table detection found {len(items)} line item(s).")
#                 try:
#                     table_md = "\n\n## Items (Extracted via PP-StructureV3)\n"
#                     table_md += "| Product | Quantity | Unit Price | Base |\n|---|---|---|---|\n"
#                     for it in items:
#                         table_md += f"| {it.product or ''} | {it.quantity or ''} | {it.grossPrice or ''} | {it.base or ''} |\n"
#                     with open(md_path, "a", encoding="utf-8") as f:
#                         f.write(table_md)
#                 except Exception as e:
#                     logger.warning(f"Could not append table to markdown: {e}")
#             else:
#                 logger.info("Table detection found no usable table.")
#         except Exception as e:
#             logger.warning(f"Table extraction failed: {e}")

#     # Suspicious document number detection
#     susp_vals = ["PEDIDO", "FACTURA", "ALBARAN", "TICKET", "ALBARÁN", "PRESUPUESTO"]
#     if inv.serialNumber:
#         doc_num_upper = inv.serialNumber.upper()
#         if not any(c.isdigit() for c in doc_num_upper) or doc_num_upper.strip() in susp_vals:
#             inv.serialNumber = None

#     # --- Stage 2: LLM fallback ---
#     missing = _missing_required_field_names(inv)
#     if not inv.items:
#         missing.append("items")

#     if _needs_llm_fallback(inv):
#         logger.info(f"Triggering LLM fallback. Missing/weak fields: {missing}")
#         try:
#             py_base = inv.subtotal
#             py_iva = inv.tax
#             py_total = inv.total
            
#             if py_base is not None and py_total is not None:
#                 if abs((py_base + (py_iva or 0)) - py_total) >= 1.0:
#                     inv.subtotal = 0.0
#                     inv.tax = 0.0
#                     inv.total = 0.0
#                     if "subtotal" not in missing: missing.append("subtotal")
#                     if "total" not in missing: missing.append("total")
            
#             # Provide the original raw text as well in case the structured_md stripped something (like marginal text)
#             full_llm_input = ocr_text + "\n\n=== RAW OCR TEXT ===\n" + page_result.raw_text
#             llm_result = extract_with_llm(full_llm_input, missing_fields=missing)
#             logger.info(f"LLM returned dict: {llm_result}")
#             inv = merge_llm_result_into_invoice(inv, llm_result, force_fields=missing)
            
#             for adj_field in ["discount", "payeAmount", "greenPointAmount", "ibeeAmount", "taxableAdditionalCost", "netAdditionalCost"]:
#                 val = getattr(inv, adj_field, 0.0)
#                 if val and py_total and abs(val - py_total) < 0.05:
#                     setattr(inv, adj_field, 0.0)
#                 elif val and py_base and abs(val - py_base) < 0.05:
#                     setattr(inv, adj_field, 0.0)

#             if py_base and py_total:
#                 if abs((py_base + (py_iva or 0)) - py_total) < 1.0:
#                     inv.subtotal = py_base
#                     inv.tax = py_iva
#                     inv.total = py_total
#             elif py_total and not inv.total:
#                 inv.total = py_total
#         except Exception as e:
#             logger.warning(f"LLM fallback failed: {e}")
#             inv.review_reasons.append(f"llm_fallback_error:{e}")
#             inv.needs_review = True
#     else:
#         logger.info("Regex stage sufficient — skipping LLM call.")

#     # Auto-heal minor OCR typos in line item base amounts (e.g., misreading 0 as 5 in the last decimal)
#     if inv.items:
#         for item in inv.items:
#             if item.quantity is not None and item.grossPrice is not None and item.base is not None:
#                 expected_base = round(item.quantity * (item.grossPrice - (item.appliedDiscount or 0)) + (item.otherFees or 0), 2)
#                 # If difference is strictly between 0.01 and 0.20 cents, it is mathematically guaranteed to be a single-digit OCR typo
#                 if 0.01 < abs(expected_base - item.base) <= 0.20:
#                     logger.info(f"Auto-healing OCR typo in line item '{item.product}' base: {item.base} -> {expected_base}")
#                     item.base = expected_base

#     # IVA Breakdown priority
#     # There are two invoice structures:
#     #   A) BAKED-IN: adjustments (discount, verde, serv) already reflected in taxable base
#     #      => brackets.subtotal + brackets.tax = printed_total  (e.g. 362.09 + 76.04 = 438.13)
#     #   B) ADDITIVE: adjustments are on top of taxable base
#     #      => brackets.subtotal + brackets.tax + adjustments = printed_total
#     if inv.taxBrackets:
#         bd_base = round(sum(r.subtotal or 0 for r in inv.taxBrackets), 2)
#         bd_iva  = round(sum(r.tax or 0 for r in inv.taxBrackets), 2)
#         bd_total = round(bd_base + bd_iva, 2)

#         row_totals_sum = round(sum(r.total or 0 for r in inv.taxBrackets), 2)
#         if abs(bd_total - row_totals_sum) < 0.05:

#             if inv.total and abs(bd_total - inv.total) < 0.10:
#                 # ── PATH A: BAKED-IN ADJUSTMENTS ──
#                 # brackets.total already equals the printed grand total.
#                 # Adjustments (discount, verde, serv) are informational — already in the base.
#                 # Store them in observations for DB visibility but do NOT add them to totals.
#                 adj_info_parts = []
#                 if inv.discount:       adj_info_parts.append(f"Descuento:{inv.discount:.2f}")
#                 if inv.greenPointAmount: adj_info_parts.append(f"PtoVerde:{inv.greenPointAmount:.2f}")
#                 if inv.taxableAdditionalCost: adj_info_parts.append(f"ServLog:{inv.taxableAdditionalCost:.2f}")
#                 if adj_info_parts and not inv.observations:
#                     inv.observations = "Adjustments baked into taxable base: " + ", ".join(adj_info_parts)
#                 # Zero out adj fields so validate.py arithmetic passes
#                 inv.discount = 0.0
#                 inv.greenPointAmount = 0.0
#                 inv.taxableAdditionalCost = 0.0
#                 inv.ibeeAmount = 0.0
#                 inv.payeAmount = 0.0
#                 inv.netAdditionalCost = 0.0
#                 inv.subtotal = bd_base
#                 inv.tax = bd_iva
#                 inv.total = bd_total
#                 logger.info(f"IVA breakdown (baked-in): base={bd_base}, iva={bd_iva}, total={bd_total}")
#             else:
#                 # ── PATH B: ADDITIVE ADJUSTMENTS ──
#                 # adjustments are on top of the taxable base
#                 disc     = abs(inv.discount or 0)
#                 adj_fees = (inv.taxableAdditionalCost or 0) + (inv.greenPointAmount or 0) + (inv.ibeeAmount or 0) - (inv.netAdditionalCost or 0) + (inv.payeAmount or 0)
#                 computed_grand_total = round(bd_total - disc + adj_fees, 2)

#                 if inv.total and abs(inv.total - bd_base) < 0.10 and bd_iva > 0:
#                     # Bug 3 fix: LLM grabbed the pre-discount gross subtotal as the grand total!
#                     logger.info(f"IVA breakdown: printed total {inv.total} matches gross base {bd_base}; recalculating real total.")
#                     inv.total = computed_grand_total

#                 if inv.total and abs(computed_grand_total - inv.total) > 0.10:
#                     # Brackets subtotal is gross IMPORTE, not net BASE.
#                     # Back-calculate from printed total.
#                     real_base = round(inv.total - bd_iva - adj_fees + disc, 2)
#                     if real_base > 0:
#                         logger.info(f"IVA breakdown: bracket base {bd_base} appears to be gross IMPORTE; correcting to net base {real_base}")
#                         bd_base = real_base
#                         for b in inv.taxBrackets:
#                             b.subtotal = real_base
#                             b.total = round(real_base + (b.tax or 0), 2)
#                     computed_grand_total = round(bd_base + bd_iva - disc + adj_fees, 2)

#                 inv.subtotal = bd_base
#                 inv.tax = bd_iva
#                 if not inv.total or abs(inv.total - computed_grand_total) >= 0.05:
#                     inv.total = computed_grand_total
#                 logger.info(f"IVA breakdown (additive): base={bd_base}, iva={bd_iva}, total={inv.total}")

#     elif inv.items:
#         computed_base = sum(li.base for li in inv.items if li.base)
#         computed_iva  = sum((li.base or 0) * ((li.iva_pct or 0) / 100.0) for li in inv.items)
#         computed_total = round(
#             computed_base 
#             + computed_iva 
#             - (inv.discount or 0) 
#             + (inv.taxableAdditionalCost or 0) 
#             + (inv.payeAmount or 0) 
#             + (inv.greenPointAmount or 0) 
#             + (inv.ibeeAmount or 0) 
#             - (inv.netAdditionalCost or 0), 
#         2)

#         if inv.total and abs(computed_total - inv.total) < 0.10:
#             inv.subtotal = round(computed_base, 2)
#             inv.tax  = round(computed_iva, 2)
#         elif abs(computed_total - (inv.total or 0)) >= 0.10:
#             comp_str1 = f"{computed_total:.2f}".replace(".", ",")
#             comp_str2 = f"{computed_total:.2f}"
#             if comp_str1 in page_result.raw_text or comp_str2 in page_result.raw_text:
#                 inv.subtotal    = round(computed_base, 2)
#                 inv.tax         = round(computed_iva, 2)
#                 inv.total       = computed_total

#     # Normalize document type to standard English
#     if inv.type:
#         type_norm = inv.type.lower()
#         if "albar" in type_norm or "delivery" in type_norm or "entrega" in type_norm:
#             inv.type = "Delivery Note"
#         elif "credit" in type_norm or "credito" in type_norm or "crédito" in type_norm:
#             inv.type = "Credit Note"
#         elif "receipt" in type_norm or "recibo" in type_norm or "ticket" in type_norm:
#             inv.type = "Receipt"
#         elif "order" in type_norm or "orden" in type_norm or "pedido" in type_norm:
#             inv.type = "Purchase Order"
#         else:
#             inv.type = "Invoice"

#     # Normalize payment method
#     if inv.payment and inv.payment.method:
#         method_norm = inv.payment.method.lower()
#         if "contado" in method_norm or "efectivo" in method_norm:
#             inv.payment.method = "Cash"

#     def reconcile_totals_from_brackets(inv: Invoice) -> Invoice:
#         """Final safety pass using taxBrackets.
#         PATH A (baked-in): if brackets_total == inv.total, brackets are already correct → no-op.
#         PATH B (additive): if they differ, try gross-IMPORTE correction."""
#         if not inv.taxBrackets:
#             return inv
#         brackets_subtotal = round(sum(b.subtotal or 0 for b in inv.taxBrackets), 2)
#         brackets_tax = round(sum(b.tax or 0 for b in inv.taxBrackets), 2)
#         brackets_total = round(brackets_subtotal + brackets_tax, 2)

#         rows_consistent = all(
#             abs((b.subtotal or 0) + (b.tax or 0) - (b.total or 0)) < 0.05
#             for b in inv.taxBrackets if b.total
#         )
#         if not any(b.total for b in inv.taxBrackets):
#             rows_consistent = True

#         if not (rows_consistent and brackets_subtotal > 0):
#             return inv

#         if inv.total and abs(brackets_total - inv.total) < 0.10:
#             # PATH A: brackets already correct — just ensure inv.subtotal/tax are set
#             if inv.subtotal != brackets_subtotal or inv.tax != brackets_tax:
#                 inv.subtotal = brackets_subtotal
#                 inv.tax = brackets_tax
#                 logger.info(f"reconcile_totals_from_brackets (baked-in): base={brackets_subtotal}, iva={brackets_tax}, total={brackets_total}")
#         elif inv.total and brackets_tax > 0:
#             # PATH B: brackets_total != inv.total → bracket subtotal is likely gross IMPORTE
#             real_base = round(inv.total - brackets_tax, 2)
#             if real_base > 0 and real_base != brackets_subtotal:
#                 logger.info(f"reconcile_totals_from_brackets (additive): bracket base {brackets_subtotal} → net base {real_base}")
#                 inv.subtotal = real_base
#                 inv.tax = brackets_tax
#         else:
#             # No inv.total available — use bracket math as best guess
#             inv.subtotal = brackets_subtotal
#             inv.tax = brackets_tax
#             inv.total = brackets_total
#             logger.info(f"reconcile_totals_from_brackets: no printed total, using bracket math total={brackets_total}")
#         return inv

#     inv = reconcile_totals_from_brackets(inv)

#     # --- Stage 3: validate ---
#     inv = validate(inv, raw_text=page_result.raw_text)
    
#     if inv.supplier.name and not re.search(
#         r"\b(S\.?[LA]\.?U?|S\.?à\s*r\.?l\.?|INC\.?|CORP\.?|LTD\.?|GMBH)\b", inv.supplier.name, re.IGNORECASE
#     ):
#         inv.review_reasons.append(f"truncated_supplier_name:{inv.supplier.name}")
#         inv.needs_review = True

#     # --- Dynamic Database Fallback for Supplier VAT ID ---
#     if not inv.supplier.vatID and inv.supplier.name:
#         try:
#             from app.ocr.storage import SessionLocal, SupplierRecord
#             with SessionLocal() as session:
#                 supplier_match = session.query(SupplierRecord).filter(
#                     SupplierRecord.name.ilike(inv.supplier.name),
#                     SupplierRecord.vatID.isnot(None)
#                 ).first()
#                 if supplier_match:
#                     inv.supplier.vatID = supplier_match.vatID
#                     logger.info(f"Backfilled missing supplier.vatID from DB using name '{inv.supplier.name}': {supplier_match.vatID}")
#         except Exception as e:
#             logger.error(f"Failed to query DB for supplier fallback: {e}")

#     if inv.needs_review:
#         logger.warning(f"NEEDS REVIEW: {inv.review_reasons}")
#     else:
#         logger.info("Validation passed — no review needed.")

#     if save_to_db:
#         from app.ocr.storage import save_invoice
#         try:
#             invoice_id = save_invoice(inv)
#             logger.info(f"Saved to PostgreSQL: invoices.id={invoice_id}")
#         except Exception as e:
#             logger.error(f"Failed to save to DB: {e}")

#     # ── Human-readable summary ──────────────────────────────────────────────
#     status_icon = "⚠️  NEEDS REVIEW" if inv.needs_review else "✅ SUCCESS"
#     supplier_name = (inv.supplier.name if inv.supplier and inv.supplier.name else "❌ Unknown")
#     supplier_vat  = (inv.supplier.vatID if inv.supplier and inv.supplier.vatID else "❌ Unknown")
#     doc_number    = inv.serialNumber or "❌ Not found"
#     doc_date      = inv.date or "❌ Not found"
#     total_val     = f"€{inv.total:.2f}" if inv.total else "❌ Not found"
#     items_count   = len(inv.items) if inv.items else 0
#     review_str    = f"\n    ⚠  Reasons: {', '.join(inv.review_reasons)}" if inv.needs_review else ""
#     logger.info(
#         f"\n"
#         f"  ┌─── OCR RESULT ───────────────────────────────────────────┐\n"
#         f"  │  Status   : {status_icon}\n"
#         f"  │  Supplier : {supplier_name} (VAT: {supplier_vat})\n"
#         f"  │  Doc No.  : {doc_number}    Date: {doc_date}\n"
#         f"  │  Total    : {total_val}    Line Items: {items_count}\n"
#         f"  │  Confidence: {(inv.ocr_confidence or 0)*100:.0f}%{review_str}\n"
#         f"  └──────────────────────────────────────────────────────────┘"
#     )
#     # ────────────────────────────────────────────────────────────────────────

#     return inv



# if __name__ == "__main__":
#     import sys
#     from rich.console import Console
#     from rich.table import Table

#     if len(sys.argv) < 2:
#         print("Usage: python pipeline.py <path_to_invoice_pdf_or_image> [--no-save]")
#         sys.exit(1)

#     save = "--no-save" not in sys.argv
#     result = process_invoice(sys.argv[1], save_to_db=save)
#     print(result.to_json())

"""
pipeline.py
============
Main orchestrator for invoice processing using the full developer blueprint.

CHANGE: added a hard review floor (see HARD_REVIEW_FLOOR) below the existing
LLM-fallback threshold. Below that floor — or when the page heuristically
looks handwritten — the pipeline stops trying to extract and logs to
review_queue.jsonl via app.ocr.triage instead of calling extract_with_llm.
Rationale: feeding low-confidence OCR text to an LLM produces a confident-
sounding guess on bad input, not a correction. Flag it for a human instead.
"""

from __future__ import annotations
import logging
import re
from dotenv import load_dotenv

load_dotenv()

from app.ocr.schema import Invoice
from app.ocr.ingest import ingest, build_invoice_markdown
from app.ocr.regex_extract import extract_with_regex
from app.ocr.table_extract import extract_line_items
from app.ocr.llm_fallback import extract_with_llm, merge_llm_result_into_invoice
from app.ocr.validate import validate, REQUIRED_FIELDS
from app.ocr.triage import looks_handwritten, log_to_review_queue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("invoice_pipeline")

OCR_CONFIDENCE_THRESHOLD = 0.70

# Below this (0.0-1.0 scale, matching page_result.avg_confidence), OCR text
# is unreliable enough that asking an LLM to "read" it just produces a
# confident-sounding guess on bad input. Flag for human review instead of
# calling extract_with_llm at all. Starting point — tune against labeled
# samples once you have some.
HARD_REVIEW_FLOOR = 0.40


def _missing_required_field_names(inv: Invoice) -> list:
    return [name for name, getter in REQUIRED_FIELDS if not getter(inv)]


def _needs_llm_fallback(inv: Invoice) -> bool:
    if _missing_required_field_names(inv):
        return True
    if inv.ocr_confidence is not None and inv.ocr_confidence < OCR_CONFIDENCE_THRESHOLD:
        return True
    if not inv.items:
        return True
    return False


def _is_below_review_floor(inv: Invoice, page_result) -> bool:
    """Hard cutoff distinct from _needs_llm_fallback's moderate threshold:
    this is the point where we stop trying to extract at all and flag for
    review instead of calling the LLM on text we don't trust."""
    if inv.ocr_confidence is not None and inv.ocr_confidence < HARD_REVIEW_FLOOR:
        return True
    if looks_handwritten(page_result.avg_confidence, page_result.low_conf_ratio, page_result.token_count):
        return True
    return False


def process_invoice(file_path: str, save_to_db: bool = True, base_name: str = "") -> Invoice:
    logger.info(f"Processing: {file_path}")

    # --- Stage 0: ingest ---
    page_result = ingest(file_path)
    logger.info(f"OCR/text extraction done. avg_confidence={page_result.avg_confidence:.1f}")

    import os
    md_outputs_dir = os.path.join(os.getcwd(), "ocr_results")
    os.makedirs(md_outputs_dir, exist_ok=True)
    if not base_name:
        base_name = os.path.splitext(os.path.basename(file_path))[0]
    md_path = os.path.join(md_outputs_dir, f"{base_name}_ocr.md")

    from app.ocr.llm_fallback import format_ocr_markdown_with_llm

    if page_result.is_native_text:
        raw_md = f"# Invoice (Native Text)\n\n{page_result.raw_text}"
    else:
        raw_md = f"# Invoice (Scanned OCR)\n\n{page_result.raw_text}"

    structured_md = format_ocr_markdown_with_llm(raw_md)

    try:
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(structured_md)
    except Exception as e:
        logger.warning(f"Could not save markdown: {e}")

    ocr_text = structured_md

    # --- Stage 1: Fast deterministic Regex ---
    inv = extract_with_regex(ocr_text)
    inv.ocr_confidence = page_result.avg_confidence

    # --- Hard review floor: check BEFORE table extraction / LLM fallback ---
    # If OCR confidence is too low to trust, or the page heuristically looks
    # handwritten, don't bother running the table model or LLM on it —
    # neither will produce a trustworthy result on input this poor. Flag and
    # return early with whatever the cheap regex pass found (likely little).
    if _is_below_review_floor(inv, page_result):
        reason = (
            "likely_handwritten_low_confidence"
            if looks_handwritten(page_result.avg_confidence, page_result.low_conf_ratio, page_result.token_count)
            else "ocr_confidence_below_hard_floor"
        )
        logger.warning(f"NEEDS REVIEW (hard floor): {reason}, avg_confidence={page_result.avg_confidence:.1f}")
        inv.needs_review = True
        inv.review_reasons.append(reason)
        log_to_review_queue(file_path, reason, inv=inv, raw_text_preview=page_result.raw_text)

        if save_to_db:
            from app.ocr.storage import save_invoice
            try:
                invoice_id = save_invoice(inv)
                logger.info(f"Saved to PostgreSQL (flagged for review): invoices.id={invoice_id}")
            except Exception as e:
                logger.error(f"Failed to save to DB: {e}")

        return inv

    if not inv.items:
        try:
            items = extract_line_items(
                file_path,
                page_result.is_native_text,
                page_result.page_images[0] if page_result.page_images else None
            )
            if items:
                inv.items = items
                logger.info(f"Table detection found {len(items)} line item(s).")
                try:
                    table_md = "\n\n## Items (Extracted via PP-StructureV3)\n"
                    table_md += "| Product | Quantity | Unit Price | Base |\n|---|---|---|---|\n"
                    for it in items:
                        table_md += f"| {it.product or ''} | {it.quantity or ''} | {it.grossPrice or ''} | {it.base or ''} |\n"
                    with open(md_path, "a", encoding="utf-8") as f:
                        f.write(table_md)
                except Exception as e:
                    logger.warning(f"Could not append table to markdown: {e}")
            else:
                logger.info("Table detection found no usable table.")
        except Exception as e:
            logger.warning(f"Table extraction failed: {e}")

    # Suspicious document number detection
    susp_vals = ["PEDIDO", "FACTURA", "ALBARAN", "TICKET", "ALBARÁN", "PRESUPUESTO"]
    if inv.serialNumber:
        doc_num_upper = inv.serialNumber.upper()
        if not any(c.isdigit() for c in doc_num_upper) or doc_num_upper.strip() in susp_vals:
            inv.serialNumber = None

    # --- Stage 2: LLM fallback ---
    # NOTE: by this point we've already passed the hard review floor above,
    # so OCR confidence is at least moderate — this LLM call is filling
    # genuine gaps (a missing field, a table the regex/table stage missed),
    # not trying to "read" unreadable text.
    missing = _missing_required_field_names(inv)
    if not inv.items:
        missing.append("items")

    if _needs_llm_fallback(inv):
        logger.info(f"Triggering LLM fallback. Missing/weak fields: {missing}")
        try:
            py_base = inv.subtotal
            py_iva = inv.tax
            py_total = inv.total

            if py_base is not None and py_total is not None:
                if abs((py_base + (py_iva or 0)) - py_total) >= 1.0:
                    inv.subtotal = 0.0
                    inv.tax = 0.0
                    inv.total = 0.0
                    if "subtotal" not in missing: missing.append("subtotal")
                    if "total" not in missing: missing.append("total")

            full_llm_input = ocr_text + "\n\n=== RAW OCR TEXT ===\n" + page_result.raw_text
            llm_result = extract_with_llm(full_llm_input, missing_fields=missing)
            logger.info(f"LLM returned dict: {llm_result}")
            inv = merge_llm_result_into_invoice(inv, llm_result, force_fields=missing)

            for adj_field in ["discount", "payeAmount", "greenPointAmount", "ibeeAmount", "taxableAdditionalCost", "netAdditionalCost"]:
                val = getattr(inv, adj_field, 0.0)
                if val and py_total and abs(val - py_total) < 0.05:
                    setattr(inv, adj_field, 0.0)
                elif val and py_base and abs(val - py_base) < 0.05:
                    setattr(inv, adj_field, 0.0)

            if py_base and py_total:
                if abs((py_base + (py_iva or 0)) - py_total) < 1.0:
                    inv.subtotal = py_base
                    inv.tax = py_iva
                    inv.total = py_total
            elif py_total and not inv.total:
                inv.total = py_total
        except Exception as e:
            logger.warning(f"LLM fallback failed: {e}")
            inv.review_reasons.append(f"llm_fallback_error:{e}")
            inv.needs_review = True
    else:
        logger.info("Regex stage sufficient — skipping LLM call.")

    # Auto-heal minor OCR typos in line item base amounts
    if inv.items:
        for item in inv.items:
            if item.quantity is not None and item.grossPrice is not None and item.base is not None:
                expected_base = round(item.quantity * (item.grossPrice - (item.appliedDiscount or 0)) + (item.otherFees or 0), 2)
                if 0.01 < abs(expected_base - item.base) <= 0.20:
                    logger.info(f"Auto-healing OCR typo in line item '{item.product}' base: {item.base} -> {expected_base}")
                    item.base = expected_base

    # IVA Breakdown priority
    if inv.taxBrackets:
        bd_base = round(sum(r.subtotal or 0 for r in inv.taxBrackets), 2)
        bd_iva  = round(sum(r.tax or 0 for r in inv.taxBrackets), 2)
        bd_total = round(bd_base + bd_iva, 2)

        row_totals_sum = round(sum(r.total or 0 for r in inv.taxBrackets), 2)
        if abs(bd_total - row_totals_sum) < 0.05:

            if inv.total and abs(bd_total - inv.total) < 0.10:
                adj_info_parts = []
                if inv.discount:       adj_info_parts.append(f"Descuento:{inv.discount:.2f}")
                if inv.greenPointAmount: adj_info_parts.append(f"PtoVerde:{inv.greenPointAmount:.2f}")
                if inv.taxableAdditionalCost: adj_info_parts.append(f"ServLog:{inv.taxableAdditionalCost:.2f}")
                if adj_info_parts and not inv.observations:
                    inv.observations = "Adjustments baked into taxable base: " + ", ".join(adj_info_parts)
                inv.discount = 0.0
                inv.greenPointAmount = 0.0
                inv.taxableAdditionalCost = 0.0
                inv.ibeeAmount = 0.0
                inv.payeAmount = 0.0
                inv.netAdditionalCost = 0.0
                inv.subtotal = bd_base
                inv.tax = bd_iva
                logger.info(f"IVA breakdown (baked-in): base={bd_base}, iva={bd_iva}, kept printed total={inv.total}")
            else:
                disc     = abs(inv.discount or 0)
                adj_fees = (inv.taxableAdditionalCost or 0) + (inv.greenPointAmount or 0) + (inv.ibeeAmount or 0) - (inv.netAdditionalCost or 0) + (inv.payeAmount or 0)
                computed_grand_total = round(bd_total - disc + adj_fees, 2)

                if inv.total and abs(inv.total - bd_base) < 0.10 and bd_iva > 0:
                    logger.info(f"IVA breakdown: printed total {inv.total} matches gross base {bd_base}; recalculating real total.")
                    inv.total = computed_grand_total

                if inv.total and abs(computed_grand_total - inv.total) > 0.10:
                    real_base = round(inv.total - bd_iva - adj_fees + disc, 2)
                    if real_base > 0:
                        logger.info(f"IVA breakdown: bracket base {bd_base} appears to be gross IMPORTE; correcting to net base {real_base}")
                        bd_base = real_base
                        for b in inv.taxBrackets:
                            b.subtotal = real_base
                            b.total = round(real_base + (b.tax or 0), 2)
                    computed_grand_total = round(bd_base + bd_iva - disc + adj_fees, 2)

                inv.subtotal = bd_base
                inv.tax = bd_iva
                if not inv.total or abs(inv.total - computed_grand_total) >= 0.05:
                    inv.total = computed_grand_total
                logger.info(f"IVA breakdown (additive): base={bd_base}, iva={bd_iva}, total={inv.total}")

    elif inv.items:
        computed_base = sum(li.base for li in inv.items if li.base)
        computed_iva  = sum((li.base or 0) * ((li.iva_pct or 0) / 100.0) for li in inv.items)
        computed_total = round(
            computed_base
            + computed_iva
            - (inv.discount or 0)
            + (inv.taxableAdditionalCost or 0)
            + (inv.payeAmount or 0)
            + (inv.greenPointAmount or 0)
            + (inv.ibeeAmount or 0)
            - (inv.netAdditionalCost or 0),
        2)

        if inv.total and abs(computed_total - inv.total) < 0.10:
            inv.subtotal = round(computed_base, 2)
            inv.tax  = round(computed_iva, 2)
        elif abs(computed_total - (inv.total or 0)) >= 0.10:
            comp_str1 = f"{computed_total:.2f}".replace(".", ",")
            comp_str2 = f"{computed_total:.2f}"
            if comp_str1 in page_result.raw_text or comp_str2 in page_result.raw_text:
                inv.subtotal    = round(computed_base, 2)
                inv.tax         = round(computed_iva, 2)
                inv.total       = computed_total

    # Normalize document type to standard English
    if inv.type:
        type_norm = inv.type.lower()
        if "albar" in type_norm or "delivery" in type_norm or "entrega" in type_norm:
            inv.type = "Delivery Note"
        elif "credit" in type_norm or "credito" in type_norm or "crédito" in type_norm:
            inv.type = "Credit Note"
        elif "receipt" in type_norm or "recibo" in type_norm or "ticket" in type_norm:
            inv.type = "Receipt"
        elif "order" in type_norm or "orden" in type_norm or "pedido" in type_norm:
            inv.type = "Purchase Order"
        else:
            inv.type = "Invoice"

    # Normalize payment method
    if inv.payment and inv.payment.method:
        method_norm = inv.payment.method.lower()
        if "contado" in method_norm or "efectivo" in method_norm:
            inv.payment.method = "Cash"

    def reconcile_totals_from_brackets(inv: Invoice) -> Invoice:
        if not inv.taxBrackets:
            return inv
        brackets_subtotal = round(sum(b.subtotal or 0 for b in inv.taxBrackets), 2)
        brackets_tax = round(sum(b.tax or 0 for b in inv.taxBrackets), 2)
        brackets_total = round(brackets_subtotal + brackets_tax, 2)

        rows_consistent = all(
            abs((b.subtotal or 0) + (b.tax or 0) - (b.total or 0)) < 0.05
            for b in inv.taxBrackets if b.total
        )
        if not any(b.total for b in inv.taxBrackets):
            rows_consistent = True

        if not (rows_consistent and brackets_subtotal > 0):
            return inv

        if inv.total and abs(brackets_total - inv.total) < 0.10:
            if inv.subtotal != brackets_subtotal or inv.tax != brackets_tax:
                inv.subtotal = brackets_subtotal
                inv.tax = brackets_tax
                logger.info(f"reconcile_totals_from_brackets (baked-in): base={brackets_subtotal}, iva={brackets_tax}, kept printed total={inv.total}")
        elif inv.total and brackets_tax > 0:
            real_base = round(inv.total - brackets_tax, 2)
            if real_base > 0 and real_base != brackets_subtotal:
                logger.info(f"reconcile_totals_from_brackets (additive): bracket base {brackets_subtotal} → net base {real_base}")
                inv.subtotal = real_base
                inv.tax = brackets_tax
        else:
            inv.subtotal = brackets_subtotal
            inv.tax = brackets_tax
            inv.total = brackets_total
            logger.info(f"reconcile_totals_from_brackets: no printed total, using bracket math total={brackets_total}")
        return inv

    inv = reconcile_totals_from_brackets(inv)

    # --- Stage 3: validate ---
    inv = validate(inv, raw_text=page_result.raw_text)

    if inv.supplier.name and not re.search(
        r"\b(S\.?[LA]\.?U?|S\.?à\s*r\.?l\.?|INC\.?|CORP\.?|LTD\.?|GMBH)\b", inv.supplier.name, re.IGNORECASE
    ):
        inv.review_reasons.append(f"truncated_supplier_name:{inv.supplier.name}")
        inv.needs_review = True

    # --- Dynamic Database Fallback for Supplier VAT ID ---
    if not inv.supplier.vatID and inv.supplier.name:
        try:
            from app.ocr.storage import SessionLocal, SupplierRecord
            with SessionLocal() as session:
                supplier_match = session.query(SupplierRecord).filter(
                    SupplierRecord.name.ilike(inv.supplier.name),
                    SupplierRecord.vatID.isnot(None)
                ).first()
                if supplier_match:
                    inv.supplier.vatID = supplier_match.vatID
                    logger.info(f"Backfilled missing supplier.vatID from DB using name '{inv.supplier.name}': {supplier_match.vatID}")
        except Exception as e:
            logger.error(f"Failed to query DB for supplier fallback: {e}")

    if inv.needs_review:
        logger.warning(f"NEEDS REVIEW: {inv.review_reasons}")
        log_to_review_queue(file_path, ",".join(inv.review_reasons), inv=inv, raw_text_preview=page_result.raw_text)
    else:
        logger.info("Validation passed — no review needed.")

    if save_to_db:
        from app.ocr.storage import save_invoice
        try:
            invoice_id = save_invoice(inv)
            logger.info(f"Saved to PostgreSQL: invoices.id={invoice_id}")
        except Exception as e:
            logger.error(f"Failed to save to DB: {e}")

    # ── Human-readable summary ──────────────────────────────────────────────
    status_icon = "⚠️  NEEDS REVIEW" if inv.needs_review else "✅ SUCCESS"
    supplier_name = (inv.supplier.name if inv.supplier and inv.supplier.name else "❌ Unknown")
    supplier_vat  = (inv.supplier.vatID if inv.supplier and inv.supplier.vatID else "❌ Unknown")
    doc_number    = inv.serialNumber or "❌ Not found"
    doc_date      = inv.date or "❌ Not found"
    total_val     = f"€{inv.total:.2f}" if inv.total else "❌ Not found"
    items_count   = len(inv.items) if inv.items else 0
    review_str    = f"\n    ⚠  Reasons: {', '.join(inv.review_reasons)}" if inv.needs_review else ""
    logger.info(
        f"\n"
        f"  ┌─── OCR RESULT ───────────────────────────────────────────┐\n"
        f"  │  Status   : {status_icon}\n"
        f"  │  Supplier : {supplier_name} (VAT: {supplier_vat})\n"
        f"  │  Doc No.  : {doc_number}    Date: {doc_date}\n"
        f"  │  Total    : {total_val}    Line Items: {items_count}\n"
        f"  │  Confidence: {(inv.ocr_confidence or 0)*100:.0f}%{review_str}\n"
        f"  └──────────────────────────────────────────────────────────┘"
    )
    # ────────────────────────────────────────────────────────────────────────

    return inv



if __name__ == "__main__":
    import sys
    from rich.console import Console
    from rich.table import Table

    if len(sys.argv) < 2:
        print("Usage: python pipeline.py <path_to_invoice_pdf_or_image> [--no-save]")
        sys.exit(1)

    save = "--no-save" not in sys.argv
    result = process_invoice(sys.argv[1], save_to_db=save)
    print(result.to_json())