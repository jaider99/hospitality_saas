"""
regex_extract.py
=================
Stage 1: cheap, deterministic extraction using bilingual keyword anchors +
regex patterns. This stage should resolve the *majority* of fields on
well-formed invoices and only leave gaps for messy/unusual layouts.
"""

from __future__ import annotations
import re
import unicodedata
from typing import Optional, List
from datetime import datetime

from app.ocr.schema import Invoice, Supplier, PaymentInfo, LineItem, LABELS


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
        return None


def _find_value_near_label(text_norm: str, original_text: str, keywords: List[str],
                            pattern: re.Pattern, window: int = 120):
    for kw in keywords:
        kw_norm = _normalize(kw)
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

SL_SUFFIX_RE = re.compile(
    r"([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü ,\-\.&']+?)"
    r"\s*,?\s*(S\.L\.U?|S\.A\.U?|S\.L|S\.A|SL|SA|S\.C\.P|SCP|S\.à\s*r\.?l\.?|INC\.?|CORP\.?|LTD\.?|GMBH)\b",
    re.IGNORECASE,
)

def _find_full_company_name(raw_text: str, partial_name: str) -> Optional[str]:
    if not partial_name:
        return partial_name
    partial_upper = partial_name.strip().upper()
    for m in SL_SUFFIX_RE.finditer(raw_text):
        candidate = m.group(0).strip().upper()
        if candidate.startswith(partial_upper) and len(candidate) > len(partial_upper):
            return m.group(0).strip()
    idx = raw_text.upper().find(partial_upper)
    if idx != -1:
        window = raw_text[idx: idx + len(partial_upper) + 60]
        m2 = SL_SUFFIX_RE.search(window)
        if m2:
            return m2.group(0).strip()
    return partial_name

# ---------------------------------------------------------------------------
# Supplier VAT ID extraction helpers
# ---------------------------------------------------------------------------

# Pattern: a legal entity suffix followed (within 80 chars) by C.I.F. / N.I.F. and a VAT ID
# e.g. "DISTRIBUCIONES E.POZO S.L. · C.I.F. B-6003877"
_LEGAL_SUFFIX_RE = re.compile(
    r"(?:S\.L\.U?\.?|S\.A\.U?\.?|S\.C\.P\.?|S\.COOP\.?|SLU?|SAU?|SL|SA)"
    r"[^\n]{0,80}?"
    r"(?:C\.I\.F\.?|N\.I\.F\.?|CIF|NIF)\s*[:\-·]?\s*([A-Z]{1,2}[\-\s]?\d{7,8}[A-Z0-9]?)",
    re.IGNORECASE,
)

# Pattern: a VAT ID on a line that starts with (or is near) a customer keyword — these must be EXCLUDED
_CUSTOMER_NIF_LINE_RE = re.compile(
    r"(?:NIF|D\.N\.I|CIF|NIE)[:\s]+([A-Z]{1,2}[\-\s]?\d{7,8}[A-Z0-9]?)",
    re.IGNORECASE,
)
_CUSTOMER_CONTEXT_KEYWORDS = re.compile(
    r"(?:CLIENTE|NOMBRE|BILL\s*TO|FACTURAR\s*A|DESTINATARIO|SHIP\s*TO|BUYER|COMPRADOR)",
    re.IGNORECASE,
)


def _extract_supplier_vat_from_header(raw_text: str) -> Optional[str]:
    """Deterministically extract the Supplier's VAT ID from the document header.

    Strategy (in priority order):
    1. Look for pattern: <LegalEntitySuffix> ... C.I.F. <VATID>  (strongest signal)
    2. Look for a line that starts with C.I.F. or N.I.F. NOT in a customer context
    3. Fallback: first TAX_ID_RE match that is NOT on a customer-NIF-labelled line
    """

    # Stage 1: Legal suffix + CIF in close proximity
    m = _LEGAL_SUFFIX_RE.search(raw_text)
    if m:
        return m.group(1).replace(" ", "").replace("-", "").upper()

    # Stage 2: Scan header lines for a C.I.F./N.I.F. that is NOT in a customer block
    header_lines = raw_text.splitlines()[:30]
    for i, line in enumerate(header_lines):
        line_norm = _normalize(line)
        # Skip lines that clearly belong to the customer section
        context = "\n".join(header_lines[max(0, i-2):i+1])
        if _CUSTOMER_CONTEXT_KEYWORDS.search(context):
            continue
        cm = _CUSTOMER_NIF_LINE_RE.search(line)
        if cm:
            # This line has a NIF label — check the surrounding context for customer keywords
            if not _CUSTOMER_CONTEXT_KEYWORDS.search(context):
                return cm.group(1).replace(" ", "").replace("-", "").upper()

    # Stage 3: Fallback — first TAX_ID_RE that is NOT on a customer-NIF line
    for line in raw_text.splitlines():
        if _CUSTOMER_CONTEXT_KEYWORDS.search(line):
            continue
        m2 = TAX_ID_RE.search(line)
        if m2:
            return m2.group(1)

    return None


# ---------------------------------------------------------------------------
# main extraction
# ---------------------------------------------------------------------------

def extract_with_regex(raw_text: str) -> Invoice:
    text_norm = _normalize(raw_text)
    inv = Invoice()

    # ---- General info ----
    date_match = _find_value_near_label(text_norm, raw_text, LABELS["date"], DATE_RE)
    inv.date = _parse_date(date_match) if date_match else None

    doc_num_match = _find_value_near_label(
        text_norm, raw_text, LABELS["serialNumber"], re.compile(r"([A-Za-z0-9/\-\s]*\d[A-Za-z0-9/\-\s]*)")
    )
    inv.serialNumber = doc_num_match.group(1).strip() if doc_num_match else None

    for kw in LABELS["type"]:
        if _normalize(kw) in text_norm:
            inv.type = kw.title()
            break

    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw_text)
    inv.documentInboxEmail = email_match.group(0) if email_match else None

    # ---- Supplier ----
    # Use the smart header-based extractor to avoid accidentally grabbing the Customer's NIF
    inv.supplier.vatID = _extract_supplier_vat_from_header(raw_text)

    # ---- Totals ----
    total_match = _find_value_near_label(text_norm, raw_text, LABELS["total"], MONEY_RE)
    inv.total = _parse_money(total_match.group(1)) if total_match else 0.0

    s1_candidates = []
    base_labels = LABELS["subtotal"]
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

    explicit_iva_match = _find_value_near_label(text_norm, raw_text, LABELS["tax"], MONEY_RE)
    explicit_iva = _parse_money(explicit_iva_match.group(1)) if explicit_iva_match else None

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

    known_total = inv.total if inv.total else None
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
                if diff_str1 in raw_text or diff_str2 in raw_text or f" {diff_str1} " in raw_text.replace("\n", " "):
                    s1_base = c
                    s1_iva_test = diff
                    s1_found = True
                    best_diff_error = 0
                    break
                err = abs((c + s1_iva_test) - known_total)
                if err < best_diff_error:
                    best_diff_error = err
                    s1_base = c
                    s1_found = True
    elif s1_candidates:
        s1_base = s1_candidates[0]
        s1_found = True

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
        if s3_found:
            base_sum, iva_sum, base_found = s3_base, s3_iva, True
        elif s1_found:
            base_sum, iva_sum, base_found = s1_base, s1_iva_test, True
        else:
            base_sum, iva_sum, base_found = s2_base, s2_iva, s2_found

    inv.subtotal = round(base_sum, 2) if base_found else 0.0
    if base_found and inv.tax == 0.0:
        inv.tax = round(iva_sum, 2) if iva_sum is not None else 0.0

    if (
        inv.subtotal is not None
        and inv.total is not None
        and inv.tax == 0.0
        and abs(inv.subtotal - inv.total) < 0.05
    ):
        inv.tax = 0.0

    if inv.subtotal is not None and inv.total is not None:
        diff = round(inv.total - inv.subtotal, 2)
        if diff > 0 and abs(inv.tax - diff) > 0.05:
            diff_str1 = f"{diff:.2f}".replace(".", ",")
            diff_str2 = f"{diff:.2f}"
            if diff_str1 in raw_text or diff_str2 in raw_text or f" {diff_str1} " in raw_text.replace("\n", " "):
                inv.tax = diff

    for label_key, attr in [
        ("discount", "discount"),
        ("payeAmount", "payeAmount"),
        ("greenPointAmount", "greenPointAmount"),
        ("ibeeAmount", "ibeeAmount"),
        ("taxableAdditionalCost", "taxableAdditionalCost"),
        ("netAdditionalCost", "netAdditionalCost"),
    ]:
        m = _find_value_near_label(text_norm, raw_text, LABELS[label_key], MONEY_RE)
        if m:
            val = _parse_money(m.group(1))
            if val is not None:
                if label_key == "discount":
                    context = raw_text[max(0, m.start()-5) : min(len(raw_text), m.end()+5)]
                    if "%" in context or "Dto" in context or "dto" in context.lower():
                        continue
                setattr(inv, attr, val)

    # ---- Status ----
    for kw, val in [("unreconciled", False), ("reconciled", True)]:
        if kw in text_norm:
            inv.isReconciled = val
            break
    for kw, val in [("unpaid", "unpaid"), ("paid", "paid")]:
        if kw in text_norm:
            inv.paidStatus = val
            break

    # ---- Special Case: Makro Line Items ----
    if "makro" in raw_text.lower():
        makro_items = _extract_makro_line_items(raw_text)
        if makro_items:
            inv.items = makro_items

    return inv


def _extract_makro_line_items(text: str) -> List[LineItem]:
    lines = text.splitlines()
    items = []
    
    for i in range(len(lines) - 1):
        line1 = lines[i].strip()
        line2 = lines[i+1].strip()
        
        code_match = re.match(r'^((?:\d\s*){6})(.*)', line1)
        if not code_match:
            continue
            
        code = code_match.group(1).replace(" ", "")
        product = code_match.group(2).strip()
        
        compact = line2.replace(" ", "")
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
                    providerCode=code,
                    product=product,
                    quantity=best_qty,
                    unit=unit if unit else None,
                    grossPrice=best_gross,
                    base=best_base,
                    iva_pct=iva_pct
                ))
        except Exception:
            continue

    return items
