"""
pipeline.py
============
Main OCR orchestrator. Entry point for processing a single invoice file.

Decision flow:
  1. ingest()              -> raw text + OCR confidence
  2. extract_with_regex()  -> fast deterministic pass
  3. LLM fallback if needed (missing fields / low confidence / no line items)
  4. validate()            -> arithmetic + completeness checks
  5. return OcrInvoice object (DB persistence is handled by the caller/worker)

Ported from OCR_invoice into hospitality-be/app/ocr/
"""

from __future__ import annotations
import logging
import os
import re

from app.ocr.schema import OcrInvoice, clean_extracted_text
from app.ocr.ingest import ingest
from app.ocr.regex_extract import extract_with_regex
from app.ocr.table_extract import extract_line_items
from app.ocr.llm_fallback import extract_with_llm, merge_llm_result_into_invoice, format_ocr_markdown_with_llm
from app.ocr.validate import validate, REQUIRED_FIELDS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr_pipeline")

OCR_CONFIDENCE_THRESHOLD = 70.0


def _missing_required_field_names(inv: OcrInvoice) -> list:
    return [name for name, getter in REQUIRED_FIELDS if getter(inv) is None]


def _needs_llm_fallback(inv: OcrInvoice) -> bool:
    if _missing_required_field_names(inv):
        return True
    if inv.meta.ocr_confidence is not None and inv.meta.ocr_confidence < OCR_CONFIDENCE_THRESHOLD:
        return True
    if not inv.line_items:
        return True
    return False


def process_invoice(file_path: str) -> OcrInvoice:
    """
    Process an invoice file and return a fully extracted OcrInvoice object.
    DB persistence is NOT done here — the caller (worker) is responsible.

    Args:
        file_path: path to PDF or image file on disk

    Returns:
        OcrInvoice with all extracted fields populated
    """
    logger.info(f"Processing: {file_path}")

    # --- Stage 0: ingest (PaddleOCR or native PDF text) ---
    page_result = ingest(file_path)
    logger.info(f"OCR/text extraction done. avg_confidence={page_result.avg_confidence:.1f}")

    # Use LLM to format raw text into clean structured markdown
    logger.info("Using LLM to construct clean markdown from extracted text...")
    if page_result.is_native_text:
        raw_md = f"# Invoice (Native Text)\n\n{page_result.raw_text}"
    else:
        raw_md = f"# Invoice (Scanned OCR)\n\n{page_result.raw_text}"

    structured_md = format_ocr_markdown_with_llm(raw_md)

    # Save structured markdown for debugging (optional)
    try:
        md_outputs_dir = os.path.join(os.getcwd(), "md_outputs")
        os.makedirs(md_outputs_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        md_path = os.path.join(md_outputs_dir, f"{base_name}_ocr.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(structured_md)
        logger.info(f"Markdown saved: {md_path}")
    except Exception as e:
        logger.warning(f"Could not save markdown: {e}")

    # Use structured markdown as the text fed to regex + LLM (much cleaner)
    ocr_text = structured_md

    # --- Stage 1: Fast deterministic Regex ---
    inv = extract_with_regex(ocr_text)
    inv.meta.source_file = file_path
    inv.meta.ocr_confidence = page_result.avg_confidence
    inv.meta.extraction_method = "regex"

    # Try table extraction for line items
    if not inv.line_items:
        try:
            items = extract_line_items(
                file_path,
                is_native_pdf_text=page_result.is_native_text,
                page_image=page_result.page_images[0] if page_result.page_images else None,
            )
            if items:
                inv.line_items = items
                logger.info(f"Table detection found {len(items)} line item(s).")
            else:
                logger.info("Table detection found no usable table.")
        except Exception as e:
            logger.warning(f"Table extraction failed: {e}")

    # Suspicious document number detection
    susp_vals = ["PEDIDO", "FACTURA", "ALBARAN", "TICKET", "ALBARÁN", "PRESUPUESTO"]
    if inv.general_info.document_number:
        doc_num_upper = inv.general_info.document_number.upper()
        if not any(c.isdigit() for c in doc_num_upper) or doc_num_upper.strip() in susp_vals:
            inv.general_info.document_number = None

    # --- Stage 2: LLM fallback for missing fields ---
    missing = _missing_required_field_names(inv)
    if not inv.line_items:
        missing.append("line_items")

    if _needs_llm_fallback(inv):
        logger.info(f"Triggering LLM fallback. Missing/weak fields: {missing}")
        inv.meta.extraction_method = "hybrid"
        try:
            py_base = inv.totals.base_amount
            py_iva = inv.totals.iva_amount
            py_total = inv.totals.total_with_iva

            if py_base is not None and py_total is not None:
                if abs((py_base + (py_iva or 0)) - py_total) >= 1.0:
                    inv.totals.base_amount = None
                    inv.totals.iva_amount = None
                    inv.totals.total_with_iva = None
                    if "totals.base_amount" not in missing:
                        missing.append("totals.base_amount")
                    if "totals.total_with_iva" not in missing:
                        missing.append("totals.total_with_iva")

            llm_result = extract_with_llm(ocr_text, missing_fields=missing)
            logger.info(f"LLM returned dict with keys: {list(llm_result.keys())}")
            inv = merge_llm_result_into_invoice(inv, llm_result, force_fields=missing)

            # Prevent LLM hallucination on adjustment fields
            for adj_field in ["discount", "paye", "green_point", "ibee", "attributable_cost", "tax_free_costs"]:
                val = getattr(inv.totals, adj_field)
                if val and py_total and abs(val - py_total) < 0.05:
                    setattr(inv.totals, adj_field, None)
                elif val and py_base and abs(val - py_base) < 0.05:
                    setattr(inv.totals, adj_field, None)

            # Restore Python-computed totals if they were mathematically valid
            if py_base is not None and py_total is not None:
                if abs((py_base + (py_iva or 0)) - py_total) < 1.0:
                    inv.totals.base_amount = py_base
                    inv.totals.iva_amount = py_iva
                    inv.totals.total_with_iva = py_total
            elif py_total is not None and inv.totals.total_with_iva is None:
                inv.totals.total_with_iva = py_total

        except Exception as e:
            logger.warning(f"LLM fallback failed: {e}")
            inv.meta.review_reasons.append(f"llm_fallback_error:{e}")
            inv.meta.needs_review = True
    else:
        logger.info("Regex stage sufficient — skipping LLM call.")

    # Reconcile IVA breakdown
    if inv.totals.iva_breakdown:
        bd_base = round(sum(r.base or 0 for r in inv.totals.iva_breakdown), 2)
        bd_iva = round(sum(r.iva_amount or 0 for r in inv.totals.iva_breakdown), 2)
        bd_total = round(bd_base + bd_iva, 2)
        computed_grand_total = round(
            bd_total
            - (inv.totals.discount or 0)
            + (inv.totals.attributable_cost or 0)
            + (inv.totals.paye or 0)
            + (inv.totals.green_point or 0)
            + (inv.totals.ibee or 0)
            - (inv.totals.tax_free_costs or 0),
            2,
        )
        row_totals_sum = round(sum(r.row_total or 0 for r in inv.totals.iva_breakdown), 2)
        if abs(bd_total - row_totals_sum) < 0.05:
            inv.totals.base_amount = bd_base
            inv.totals.iva_amount = bd_iva
            if inv.totals.total_with_iva is not None and abs(inv.totals.total_with_iva - bd_total) < 0.05:
                computed_grand_total = bd_total
            if inv.totals.total_with_iva is None or abs(inv.totals.total_with_iva - computed_grand_total) >= 0.05:
                inv.totals.total_with_iva = computed_grand_total
            logger.info(f"IVA breakdown reconciled: base={bd_base}, iva={bd_iva}, total={computed_grand_total}")

    elif inv.line_items:
        computed_base = sum(li.base for li in inv.line_items if li.base is not None)
        computed_iva = sum((li.base or 0) * ((li.iva_pct or 0) / 100.0) for li in inv.line_items)
        computed_total = round(
            computed_base
            + computed_iva
            - (inv.totals.discount or 0)
            + (inv.totals.attributable_cost or 0)
            + (inv.totals.paye or 0)
            + (inv.totals.green_point or 0)
            + (inv.totals.ibee or 0)
            - (inv.totals.tax_free_costs or 0),
            2,
        )
        if inv.totals.total_with_iva and abs(computed_total - inv.totals.total_with_iva) < 0.10:
            inv.totals.base_amount = round(computed_base, 2)
            inv.totals.iva_amount = round(computed_iva, 2)
        elif abs(computed_total - (inv.totals.total_with_iva or 0)) >= 0.10:
            comp_str1 = f"{computed_total:.2f}".replace(".", ",")
            comp_str2 = f"{computed_total:.2f}"
            if comp_str1 in page_result.raw_text or comp_str2 in page_result.raw_text:
                inv.totals.base_amount = round(computed_base, 2)
                inv.totals.iva_amount = round(computed_iva, 2)
                inv.totals.total_with_iva = computed_total

    # Clean string fields before validation
    inv.supplier.display_name = clean_extracted_text(inv.supplier.display_name)
    inv.supplier.legal_name = clean_extracted_text(inv.supplier.legal_name)
    inv.supplier.address = clean_extracted_text(inv.supplier.address)
    inv.general_info.document_number = clean_extracted_text(inv.general_info.document_number)
    inv.general_info.document_type = clean_extracted_text(inv.general_info.document_type)
    inv.general_info.category = clean_extracted_text(inv.general_info.category)

    # --- Stage 3: validate ---
    inv = validate(inv)

    # Flag truncated supplier name
    if inv.supplier.display_name and not re.search(
        r"\b(S\.?[LA]\.?U?|S\.?à\s*r\.?l\.?|INC\.?|CORP\.?|LTD\.?|GMBH)\b",
        inv.supplier.display_name,
        re.IGNORECASE,
    ):
        inv.meta.review_reasons.append(f"truncated_supplier_name:{inv.supplier.display_name}")
        inv.meta.needs_review = True

    if inv.meta.needs_review:
        logger.warning(f"NEEDS REVIEW: {inv.meta.review_reasons}")
    else:
        logger.info("Validation passed — no review needed.")

    return inv
