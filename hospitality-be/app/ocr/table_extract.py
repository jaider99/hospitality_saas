"""
table_extract.py
=================
Detects and extracts table structure (specifically the line-items table)
from an invoice page using PaddleOCR's PP-StructureV3 layout-analysis
pipeline. This is a separate module from plain OCR because PP-Structure
does layout detection (paragraphs/tables/figures) + table cell structure,
not just text+bbox like the base PaddleOCR().ocr() call in ingest.py.

Two source paths, same as ingest.py:
  - Native-text PDF with a real table   -> pdfplumber.extract_table() (free,
                                            exact, no OCR/model needed at all)
  - Scanned PDF / photographed invoice  -> PP-StructureV3 table model

Install:
    pip install paddleocr paddlepaddle pdfplumber pymupdf
"""

from __future__ import annotations
from typing import List, Optional
import re
import unicodedata

import pdfplumber

from app.ocr.schema import LineItem, LINE_ITEM_HEADERS


# ---------------------------------------------------------------------------
# Lazy singleton — PP-Structure model is heavy, load once per process.
# ---------------------------------------------------------------------------
_pp_structure_instance = None


def _get_pp_structure():
    global _pp_structure_instance
    if _pp_structure_instance is None:
        try:
            # paddleocr >= 3.0: class renamed, different constructor args
            from paddleocr import PPStructureV3
            _pp_structure_instance = PPStructureV3(
                lang="es",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_formula_recognition=False,
                use_seal_recognition=False,
                use_chart_recognition=False,
            )
        except ImportError:
            # paddleocr < 3.0: old class/args
            from paddleocr import PPStructure
            _pp_structure_instance = PPStructure(table=True, ocr=True, lang="es", show_log=False)
    return _pp_structure_instance


def _normalize(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s.lower().strip()


# ---------------------------------------------------------------------------
# Path A: native-text PDF — exact table extraction, no OCR involved at all
# ---------------------------------------------------------------------------

def extract_table_native_pdf(pdf_path: str) -> List[List[str]]:
    """Returns the first detected table as a list of rows (list of cell
    strings), header row included. Returns [] if no table found."""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                # Heuristic: the line-items table is usually the largest
                # table on the page (most rows/columns).
                return max(tables, key=lambda t: len(t) * len(t[0] if t else []))
    return []


# ---------------------------------------------------------------------------
# Path B: scanned/photographed invoice — PP-StructureV3 table model
# ---------------------------------------------------------------------------

def extract_table_image(image_path_or_array) -> List[List[str]]:
    """Runs PP-StructureV3 (or legacy PPStructure on paddleocr<3.0) on an
    image and returns the largest detected table as rows of cell text.
    Accepts either a file path or a numpy array (e.g. a page rasterized
    from a scanned PDF, reused from ingest.py)."""
    import cv2

    structure_engine = _get_pp_structure()

    if isinstance(image_path_or_array, str):
        img = cv2.imread(image_path_or_array)
    else:
        img = image_path_or_array

    # PPStructureV3 (3.x): use .predict(); legacy PPStructure (2.x): callable
    if hasattr(structure_engine, "predict"):
        result = structure_engine.predict(img)
    else:
        result = structure_engine(img)

    html = _find_largest_table_html(result)
    if not html:
        return []
    return _html_table_to_rows(html)


def _find_largest_table_html(result) -> Optional[str]:
    """Digs through either result schema to find table HTML.

    PPStructureV3 (3.x): result is a list of result objects, each with a
        'table_res_list' key/attr containing dicts with 'pred_html'.
    Legacy PPStructure (2.x): result is a list of region dicts, each with
        'type'=='table' and res={'html': ...}.
    Tries both shapes; returns None if neither matches (caller falls back
    to LLM extraction for line items).
    """
    candidates = []  # list of (approx_size, html)

    for item in result:
        # --- 3.x shape ---
        table_list = None
        if isinstance(item, dict) and "table_res_list" in item:
            table_list = item["table_res_list"]
        elif hasattr(item, "table_res_list"):
            table_list = item.table_res_list
        elif hasattr(item, "get"):
            try:
                table_list = item.get("table_res_list")
            except Exception:
                table_list = None

        if table_list:
            for t in table_list:
                html = t.get("pred_html") if isinstance(t, dict) else getattr(t, "pred_html", None)
                if html:
                    candidates.append((len(html), html))
            continue

        # --- 2.x shape ---
        if isinstance(item, dict) and item.get("type") == "table":
            html = item.get("res", {}).get("html", "")
            if html:
                candidates.append((len(html), html))

    if not candidates:
        return None
    return max(candidates, key=lambda c: c[0])[1]


def _html_table_to_rows(html: str) -> List[List[str]]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if cells:
            rows.append(cells)
    return rows


# ---------------------------------------------------------------------------
# Column mapping: raw table rows -> List[LineItem]
# ---------------------------------------------------------------------------

NUMERIC_FIELDS = {"quantity", "grossPrice", "discountPct", "appliedDiscount",
                   "otherFees", "nominalPrice", "iva_pct", "base"}

MONEY_RE = re.compile(r"(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|\d+)")


def _parse_number(raw: str) -> Optional[float]:
    if raw is None:
        return None
    raw = raw.strip().replace("€", "").replace("%", "").strip()
    if not raw:
        return None
    if re.match(r"^\d{1,3}(\.\d{3})*,\d{2}$", raw):
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw and "." not in raw:
        raw = raw.replace(",", ".")
    match = MONEY_RE.search(raw)
    if not match:
        return None
    try:
        return float(match.group(1).replace(" ", ""))
    except ValueError:
        return None


def _map_header_to_field(header_text: Optional[str]) -> Optional[str]:
    if not header_text:
        return None
    header_norm = _normalize(header_text)
    for field_name, synonyms in LINE_ITEM_HEADERS.items():
        for syn in synonyms:
            if _normalize(syn) in header_norm or header_norm in _normalize(syn):
                return field_name
    return None


def rows_to_line_items(rows: List[List[str]]) -> List[LineItem]:
    """Converts raw table rows (header row + data rows) into LineItem
    objects, mapping columns by header text via LINE_ITEM_HEADERS synonyms.
    This is template-agnostic: it doesn't care which column order a given
    supplier uses, only what each header *means*.
    """
    if len(rows) < 2:
        return []  # need at least a header row + one data row

    header_row = rows[0]
    column_fields = [_map_header_to_field(h) for h in header_row]

    if all(f is None for f in column_fields):
        # Header row didn't match any known synonyms — table layout is
        # too unusual for this generic mapper. Caller should fall back
        # to the LLM for line items in this case.
        return []

    SUMMARY_ROW_KEYWORDS = ("subtotal", "total", "iva", "vat", "base imponible", "base amount")

    line_items = []
    for data_row in rows[1:]:
        row_text_norm = _normalize(" ".join(c for c in data_row if c))
        if any(kw in row_text_norm for kw in SUMMARY_ROW_KEYWORDS):
            continue  # this is a totals/summary row sharing the table, not a real line item

        kwargs = {}
        for col_idx, field_name in enumerate(column_fields):
            if field_name is None or col_idx >= len(data_row):
                continue
            raw_value = data_row[col_idx]
            if raw_value is None:
                continue
            kwargs[field_name] = _parse_number(raw_value) if field_name in NUMERIC_FIELDS else raw_value.strip()

        # Fallback for merged-cell headers (e.g. "DESCRIPCIÓN IMPORTE" in one
        # cell while the actual amount lives in its own unlabeled data
        # column): if no money field got mapped, grab the first column whose
        # value parses as money and wasn't already consumed by 'product'.
        if not any(k in kwargs for k in ("base", "grossPrice", "nominalPrice")):
            for col_idx, raw_value in enumerate(data_row):
                if raw_value is None or column_fields[col_idx] == "product":
                    continue
                parsed = _parse_number(raw_value)
                if parsed is not None:
                    kwargs["base"] = parsed
                    break

        if kwargs:
            line_items.append(LineItem(**kwargs))

    # Sanity guard: reject obviously-garbled results (e.g. merged/rowspan
    # cells that stacked unrelated sub-receipt text into one field, as seen
    # in some POS-system invoices). Better to return [] and let the LLM
    # fallback handle a messy table than to store corrupted line items.
    for li in line_items:
        if li.product and (len(li.product) > 100 or li.product.count("\n") > 1):
            return []

    return line_items


HEADER_FIELD_SYNONYMS = {
    "type":   ["documento", "document"],
    "serialNumber": ["numero", "número", "no.", "nº", "n°", "invoice number", "factura n"],
    "date":            ["fecha", "date", "data"],
}


def extract_header_table_native_pdf(pdf_path: str) -> dict:
    """Looks for a small header table (e.g. DOCUMENTO | NÚMERO | FECHA |
    VENCIMIENTO over Factura | 2485/26 | 02/06/2026 | 30 DÍAS) and maps it
    to general_info fields by header meaning. This solves the case where
    label and value end up far apart in the flat extracted text because
    pdfplumber's reading order groups all header cells together and all
    value cells together.

    Handles TWO table shapes, both seen in real invoices:
      (a) header row + separate value row:
          [["DOCUMENTO", "NÚMERO", "FECHA"], ["Factura", "2485/26", "02/06/2026"]]
      (b) header and value combined in a single cell, newline-separated:
          [["DOCUMENTO\\nFactura", "NÚMERO\\n2485/26", "FECHA\\n02/06/2026"]]

    Returns {} if no matching table is found.
    """
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table:
                    continue

                # Shape (b): single row, each cell is "LABEL\nVALUE"
                if len(table) == 1:
                    mapped = {}
                    for cell in table[0]:
                        if not cell or "\n" not in cell:
                            continue
                        label_part, value_part = cell.split("\n", 1)
                        label_norm = _normalize(label_part)
                        for field_name, synonyms in HEADER_FIELD_SYNONYMS.items():
                            if any(syn in label_norm for syn in synonyms):
                                mapped[field_name] = value_part.strip()
                                break
                    if mapped.get("serialNumber"):
                        return mapped
                    continue

                # Shape (a): separate header row + value row
                header_row = [(_normalize(c) if c else "") for c in table[0]]
                value_row = table[1]
                mapped = {}
                for col_idx, header_cell in enumerate(header_row):
                    if col_idx >= len(value_row) or not value_row[col_idx]:
                        continue
                    for field_name, synonyms in HEADER_FIELD_SYNONYMS.items():
                        if any(syn in header_cell for syn in synonyms):
                            mapped[field_name] = value_row[col_idx].strip()
                            break
                if mapped.get("serialNumber"):
                    return mapped
    return {}


def extract_header_fields(file_path: str, is_native_pdf_text: bool) -> dict:
    """Public entry point used by pipeline.py. Currently only the native-PDF
    path is implemented (covers any digitally-generated invoice with a real
    text layer, which is the common case for header-table layouts like
    document 2). Scanned/photographed header tables would need the same
    PP-StructureV3 table call already used for line items — left as a
    follow-up since this template is rarer for header boxes specifically.
    """
    if is_native_pdf_text:
        return extract_header_table_native_pdf(file_path)
    return {}


# ---------------------------------------------------------------------------
# Public entry point used by pipeline.py
# ---------------------------------------------------------------------------

def extract_line_items(file_path: str, is_native_pdf_text: bool, page_image=None) -> List[LineItem]:
    """
    file_path: original invoice path (used for native-PDF table extraction)
    is_native_pdf_text: True if ingest.py determined this PDF has a real text layer
    page_image: optional pre-rasterized numpy image (reuse from ingest.py's
                rasterization step instead of re-rendering the page)
    """
    if is_native_pdf_text:
        rows = extract_table_native_pdf(file_path)
    else:
        target = page_image if page_image is not None else file_path
        rows = extract_table_image(target)

    if not rows:
        return []

    return rows_to_line_items(rows)