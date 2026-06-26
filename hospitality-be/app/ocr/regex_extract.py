"""
regex_extract.py
=================
Stage 1: cheap, deterministic extraction using bilingual keyword anchors +
regex patterns. This stage should resolve the *majority* of fields on
well-formed invoices and only leave gaps for messy/unusual layouts.

Strategy: for every label in schema.LABELS, search the raw OCR/PDF text for
a keyword occurrence (case-insensitive, accent-insensitive), then look at a
window of text right after it (same line, or next ~60 chars) for a value
matching the expected pattern (date / money / id / free text).
"""

from __future__ import annotations
import re
import unicodedata
from typing import Optional, List
from datetime import datetime

from app.ocr.schema import OcrInvoice as Invoice, GeneralInfo, Supplier, Totals, StatusInfo, LineItem, LABELS, clean_extracted_text


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _normalize(s: str) -> str:
    return _strip_accents(s).lower()


MONEY_RE = re.compile(r"(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s*€?")
DATE_RE = re.compile(r"(\d{1,2})(?:[/\-\s]| de )+([A-Za-z0-9]+)\.?(?:[/\-\s]| de )+(\d{2,4})", re.IGNORECASE)
TAX_ID_RE = re.compile(r"\b([A-Z]{1,2}\d{7,8}[A-Z0-9]?)\b")
PCT_RE = re.compile(r"(\d{1,2}(?:[.,]\d+)?)\s?%")

MONTHS = {
    "jan": "01", "january": "01", "ene": "01", "enero": "01",
    "feb": "02", "february": "02", "febrero": "02",
    "mar": "03", "march": "03", "marzo": "03",
    "apr": "04", "april": "04", "abr": "04", "abril": "04",
    "may": "05", "mayo": "05",
    "jun": "06", "june": "06", "junio": "06",
    "jul": "07", "july": "07", "julio": "07",
    "aug": "08", "august": "08", "ago": "08", "agosto": "08",
    "sep": "09", "september": "09", "septiembre": "09",
    "oct": "10", "october": "10", "octubre": "10",
    "nov": "11", "november": "11", "noviembre": "11",
    "dec": "12", "december": "12", "dic": "12", "diciembre": "12",
}

def _parse_money(raw: str) -> Optional[float]:
    """Handles both EU format (1.234,56) and plain (250,00 / 250.00)."""
    if not raw:
        return None
    cleaned = raw.strip().replace(" ", "")
    # EU: thousands='.', decimal=','
    if re.match(r"^\d{1,3}(\.\d{3})*,\d{2}$", cleaned):
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_date(raw_match) -> Optional[str]:
    if not raw_match:
        return None
    d, m, y = raw_match.groups()
    m_clean = m.lower().strip()
    if m_clean in MONTHS:
        m = MONTHS[m_clean]
    elif not m.isdigit():
        return None
        
    if len(y) == 2:
        y = "20" + y
    try:
        return datetime(int(y), int(m), int(d)).date().isoformat()
    except ValueError:
        # could be MM/DD/YYYY (US-style English invoice) — try swapped
        try:
            return datetime(int(y), int(d), int(m)).date().isoformat()
        except ValueError:
            return None


def _find_value_near_label(text_norm: str, original_text: str, keywords: List[str],
                            pattern: re.Pattern, window: int = 120):
    """Search for the first keyword occurrence, then look for `pattern`
    within `window` characters AFTER it on the original (non-normalized)
    text, preserving original casing/punctuation for parsing."""
    for kw in keywords:
        kw_norm = _normalize(kw)
        # Create a regex that allows optional spaces between every character of the keyword
        # e.g. "total" -> r"t\s*o\s*t\s*a\s*l"
        spaced_pattern = r"\s*".join(re.escape(c) for c in kw_norm.replace(" ", ""))
        kw_re = re.compile(spaced_pattern)
        
        match_kw = kw_re.search(text_norm)
        if not match_kw:
            continue
        
        start_idx = max(0, match_kw.start() - window)
        end_idx = min(len(original_text), match_kw.end() + window)
        snippet = original_text[start_idx:end_idx]
        
        matches = list(pattern.finditer(snippet))
        if matches:
            kw_center = match_kw.start() - start_idx + (match_kw.end() - match_kw.start()) // 2
            def distance(m):
                m_center = (m.start() + m.end()) // 2
                return abs(m_center - kw_center)
            
            best_match = min(matches, key=distance)
            return best_match
    return None


# ---------------------------------------------------------------------------
# helper: complete truncated company names (e.g. "LA TIENDA DEL" -> "LA TIENDA DEL BARMAN, S.L.")
# ---------------------------------------------------------------------------

SL_SUFFIX_RE = re.compile(
    r"([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü ,\-\.&']+?)"
    r"\s*,?\s*(S\.L\.U?|S\.A\.U?|S\.L|S\.A|SL|SA|S\.C\.P|SCP|S\.à\s*r\.?l\.?|INC\.?|CORP\.?|LTD\.?|GMBH)\b",
    re.IGNORECASE,
)


def _find_full_company_name(raw_text: str, partial_name: str) -> Optional[str]:
    """If partial_name is truncated (no S.L./S.A. suffix), scan raw_text
    for a longer match that starts with partial_name and ends with a legal-form suffix."""
    if not partial_name:
        return partial_name
    partial_upper = partial_name.strip().upper()
    for m in SL_SUFFIX_RE.finditer(raw_text):
        candidate = m.group(0).strip().upper()
        if candidate.startswith(partial_upper) and len(candidate) > len(partial_upper):
            return m.group(0).strip()
    # Wider approach: find partial name in text, grab 60 chars after it
    idx = raw_text.upper().find(partial_upper)
    if idx != -1:
        window = raw_text[idx: idx + len(partial_upper) + 60]
        m2 = SL_SUFFIX_RE.search(window)
        if m2:
            return m2.group(0).strip()
    return partial_name


# ---------------------------------------------------------------------------
# main extraction
# ---------------------------------------------------------------------------

def extract_with_regex(raw_text: str) -> Invoice:
    text_norm = _normalize(raw_text)
    inv = Invoice()

    # ---- General info ----
    date_match = _find_value_near_label(text_norm, raw_text, LABELS["date"], DATE_RE)
    inv.general_info.date = _parse_date(date_match) if date_match else None

    doc_num_match = _find_value_near_label(
        text_norm, raw_text, LABELS["document_number"], re.compile(r"([A-Za-z0-9/\-]*\d[A-Za-z0-9/\-]*)")
    )
    inv.general_info.document_number = doc_num_match.group(1).strip() if doc_num_match else None

    for kw in LABELS["document_type"]:
        if _normalize(kw) in text_norm:
            inv.general_info.document_type = kw.title()
            break

    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw_text)
    inv.general_info.uploaded_by = email_match.group(0) if email_match else None

    # ---- Supplier ----
    tax_id_match = TAX_ID_RE.search(raw_text)
    inv.supplier.tax_id = tax_id_match.group(1) if tax_id_match else None

    # ---- Supplier Display Name Fallback ----
    supplier_name = None
    known_suppliers = [
        "Beverage Source Ltd",
        "Fresh Foods Express",
        "MAKRO DISTRIBUCION",
        "MAKRO",
        "Re Pla Tres S.L.",
        "Re Pla Tres",
        "Holaluz-clidom S.A.",
        "Holaluz",
        "La Tienda Del Barman",
        "Vendo lo que tengo"
    ]
    for k_supp in known_suppliers:
        if k_supp.lower() in text_norm:
            supplier_name = k_supp
            break
            
    if not supplier_name:
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        for line in lines:
            cleaned = clean_extracted_text(line)
            if not cleaned:
                continue
            line_norm = _normalize(cleaned)
            if any(lbl in line_norm for lbl in ["factura", "albaran", "ticket", "invoice", "cliente", "client", "nif", "cif", "c.i.f", "n.i.f", "c/.", "fecha", "date", "supplier", "proveedor", "emisor", "vendor", "vendedor", "seller"]):
                continue
            if len(cleaned) < 3 or len(cleaned) > 50:
                continue
            if any(c.isdigit() for c in cleaned) and not any(c.isalpha() for c in cleaned):
                continue
            supplier_name = cleaned
            break
            
    inv.supplier.display_name = clean_extracted_text(supplier_name)

    # ---- Totals ----
    # For total_with_iva, look for high-priority labels first (P. PAGADOS, etc.)
    total_match = _find_value_near_label(text_norm, raw_text, LABELS["total_with_iva"], MONEY_RE)
    inv.totals.total_with_iva = _parse_money(total_match.group(1)) if total_match else None

    s1_candidates = []
    base_labels = ["base imp", "base imponible", "base amount", "importe bruto", "subtotal", "importe", "net amount", "taxable amount", "taxable base"]
    for lbl in base_labels:
        spaced_pattern = r"\s*".join(re.escape(c) for c in _normalize(lbl).replace(" ", ""))
        lbl_re = re.compile(spaced_pattern)
        search_start = 0
        while True:
            match_lbl = lbl_re.search(text_norm, search_start)
            if not match_lbl:
                break
            
            start = match_lbl.end()
            snippet = raw_text[start: start + 80]
            m = MONEY_RE.search(snippet)
            if m:
                val = _parse_money(m.group(1))
                if val is not None:
                    s1_candidates.append(val)
            search_start = match_lbl.end()

    # Strategy 2 — IVA bracket table (ALWAYS runs, compared against S1 at the end)
    s2_base = 0.0
    s2_iva = 0.0
    s2_found = False
    IVA_BRACKET_RE = re.compile(
        r"(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*€?\s+(\d{1,2}(?:[.,]\d+)?)\s*(?:%|\s|$)"
    )
    for line in raw_text.split("\n"):
        m = IVA_BRACKET_RE.search(line)
        if m:
            val = _parse_money(m.group(1))
            rate_str = m.group(2).replace(",", ".")
            rate = float(rate_str) if rate_str else 0.0
            if rate >= 10.0 and val is not None:
                s2_base += val
                s2_iva += val * (rate / 100.0)
                s2_found = True

    # Try to find explicit IVA amount label
    explicit_iva_match = _find_value_near_label(text_norm, raw_text, LABELS["iva_amount"], MONEY_RE)
    explicit_iva = _parse_money(explicit_iva_match.group(1)) if explicit_iva_match else None

    # Strategy 3: "Rate% Base IVA" format (e.g. Amazon invoices)
    s3_base = 0.0
    s3_iva = 0.0
    s3_found = False
    S3_RE = re.compile(
        r"^\s*(\d{1,2}(?:[.,]\d+)?)\s*%\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*€?\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*€?"
    )
    for line in raw_text.split("\n"):
        m = S3_RE.search(line)
        if m:
            b_val = _parse_money(m.group(2))
            i_val = _parse_money(m.group(3))
            if b_val is not None and i_val is not None:
                s3_base += b_val
                s3_iva += i_val
                s3_found = True

    # Evaluate S1 candidates to find the best matching base
    known_total = inv.totals.total_with_iva
    s1_base = 0.0
    s1_iva_test = explicit_iva if explicit_iva is not None else 0.0
    s1_found = False
    
    if known_total and s1_candidates:
        best_diff_error = float('inf')
        for c in s1_candidates:
            diff = round(known_total - c, 2)
            if diff > 0:
                diff_str1 = f"{diff:.2f}".replace(".", ",")
                diff_str2 = f"{diff:.2f}"
                # If diff is exactly in text, this is a PERFECT base
                if diff_str1 in raw_text or diff_str2 in raw_text or f" {diff_str1} " in raw_text.replace("\n", " "):
                    s1_base = c
                    s1_iva_test = diff
                    s1_found = True
                    best_diff_error = 0
                    break
                # Or if base + explicit IVA matches total perfectly
                err = abs((c + s1_iva_test) - known_total)
                if err < best_diff_error:
                    best_diff_error = err
                    s1_base = c
                    s1_found = True
    elif s1_candidates:
        s1_base = s1_candidates[0] # Just pick first if no total to verify
        s1_found = True

    # Pick the strategy whose (base + iva) is closest to total_with_iva
    if known_total:
        s1_err = abs((s1_base + s1_iva_test) - known_total) if s1_found else float("inf")
        s2_err = abs((s2_base + s2_iva) - known_total) if s2_found else float("inf")
        s3_err = abs((s3_base + s3_iva) - known_total) if s3_found else float("inf")
        
        if s1_found and s1_err < 0.05:
            base_sum, iva_sum, base_found = s1_base, s1_iva_test, True
        elif s3_found and s3_err < 0.05:
            base_sum, iva_sum, base_found = s3_base, s3_iva, True
        elif s2_found and s2_err < 0.05:
            base_sum, iva_sum, base_found = s2_base, s2_iva, True
        elif s3_found and s3_err < min(s1_err, s2_err):
            base_sum, iva_sum, base_found = s3_base, s3_iva, True
        elif s2_found and s2_err < s1_err:
            base_sum, iva_sum, base_found = s2_base, s2_iva, True
        else:
            base_sum, iva_sum, base_found = s1_base, s1_iva_test, s1_found
    else:
        # Fallback priority if no known total: S3 > S1 > S2
        if s3_found:
            base_sum, iva_sum, base_found = s3_base, s3_iva, True
        elif s1_found:
            base_sum, iva_sum, base_found = s1_base, s1_iva_test, True
        else:
            base_sum, iva_sum, base_found = s2_base, s2_iva, s2_found

    inv.totals.base_amount = round(base_sum, 2) if base_found else None
    # Python-computed (or explicitly extracted) iva_amount
    if base_found and inv.totals.iva_amount is None:
        inv.totals.iva_amount = round(iva_sum, 2) if iva_sum is not None else 0.0

    # Sanity: if base ≈ total and iva still None → IVA is 0 (delivery note or zero-rate)
    if (
        inv.totals.base_amount is not None
        and inv.totals.total_with_iva is not None
        and inv.totals.iva_amount == 0.0
        and abs(inv.totals.base_amount - inv.totals.total_with_iva) < 0.05
    ):
        inv.totals.iva_amount = 0.0

    # Cross-check: If base + iva != total, but total - base == a number printed on the page, use it as IVA
    if inv.totals.base_amount is not None and inv.totals.total_with_iva is not None:
        diff = round(inv.totals.total_with_iva - inv.totals.base_amount, 2)
        if diff > 0 and abs(inv.totals.iva_amount - diff) > 0.05:
            diff_str1 = f"{diff:.2f}".replace(".", ",")
            diff_str2 = f"{diff:.2f}"
            # Check if this number exists in the raw text
            if diff_str1 in raw_text or diff_str2 in raw_text or f" {diff_str1} " in raw_text.replace("\n", " "):
                inv.totals.iva_amount = diff



    # Other totals (skip iva_amount as it was handled above)
    for label_key, attr in [
        ("discount", "discount"),
        ("paye", "paye"),
        ("green_point", "green_point"),
        ("ibee", "ibee"),
        ("attributable_cost", "attributable_cost"),
        ("tax_free_costs", "tax_free_costs"),
    ]:
        m = _find_value_near_label(text_norm, raw_text, LABELS[label_key], MONEY_RE)
        if m:
            setattr(inv.totals, attr, _parse_money(m.group(1)))

    # ---- Status ----
    for kw, val in [("unreconciled", "Unreconciled"), ("reconciled", "Reconciled")]:
        if kw in text_norm:
            inv.status.reconciliation_status = val
            break
    for kw, val in [("unpaid", "Unpaid"), ("paid", "Paid")]:
        if kw in text_norm:
            inv.status.payment_status = val
            break

    # ---- Special Case: Makro Line Items ----
    # If we know this is Makro, we can deterministically parse their garbled table
    if "makro" in raw_text.lower():
        makro_items = _extract_makro_line_items(raw_text)
        if makro_items:
            inv.line_items = makro_items

    inv.meta.extraction_method = "regex"
    return inv


# NOTE: line-item table extraction now lives in table_extract.py
# (rows_to_line_items / extract_line_items), since it needs PP-StructureV3
# / pdfplumber table detection rather than plain regex on flat text.

def _extract_makro_line_items(text: str) -> List[LineItem]:
    lines = text.splitlines()
    items = []
    
    for i in range(len(lines) - 1):
        line1 = lines[i].strip()
        line2 = lines[i+1].strip()
        
        # A valid line1 starts with exactly 6 digits (spaced or not)
        code_match = re.match(r'^((?:\d\s*){6})(.*)', line1)
        if not code_match:
            continue
            
        code = code_match.group(1).replace(" ", "")
        product = code_match.group(2).strip()
        
        compact = line2.replace(" ", "")
        
        # There must be exactly 3 commas in the compact string for Makro
        if compact.count(',') != 3:
            continue
            
        parts = compact.split(',')
        if len(parts) != 4:
            continue
            
        try:
            dec3 = parts[3][:2]
            iva_code_str = parts[3][2:]
            if not iva_code_str:
                continue
            iva_code = int(iva_code_str)
            iva_pct = 21 if iva_code == 2 else 10 if iva_code == 1 else 4 if iva_code in (4, 5) else 0
            
            dec2 = parts[2][:2]
            dec1 = parts[1][:2]
            
            int1_str = re.search(r'\d+$', parts[0])
            if not int1_str: continue
            int1 = int1_str.group()
            unit = parts[0][:-len(int1)]
            
            rem2 = parts[2][2:] 
            rem1 = parts[1][2:] 
            
            best_diff = 999999
            best_qty = 1
            best_base = 0.0
            best_gross = 0.0
            
            for split_qty in range(1, len(rem2)):
                qty_str = rem2[:split_qty]
                int3_str = rem2[split_qty:]
                
                for split_spacer in range(1, len(rem1)):
                    int2_str = rem1[split_spacer:]
                    
                    try:
                        qty = int(qty_str)
                        base = float(f"{int3_str}.{dec3}")
                        gross = float(f"{int2_str}.{dec2}")
                        
                        diff = abs((qty * gross) - base)
                        if diff < best_diff:
                            best_diff = diff
                            best_qty = qty
                            best_base = base
                            best_gross = gross
                    except:
                        pass
                        
            if best_diff < 0.1:
                items.append(LineItem(
                    provider_code=code,
                    product=product,
                    quantity=best_qty,
                    unit=unit if unit else None,
                    gross_price=best_gross,
                    base=best_base,
                    iva_pct=iva_pct
                ))
        except Exception:
            continue

    return items
