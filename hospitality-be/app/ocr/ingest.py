"""
ingest.py
=========
Stage 0: turn a file (PDF or image, EN/ES, scanned or native) into:
  - raw_text: best-effort plain text
  - tokens: list of (text, x0, y0, x1, y1, confidence) for layout-aware steps
  - avg_confidence: average OCR confidence (100 for native PDF text)

Decision tree:
  PDF with an extractable text layer -> use it directly (fast, free, 100% accurate)
  PDF without text layer (scanned)   -> rasterize pages -> PaddleOCR
  Image file (jpg/png/etc.)          -> PaddleOCR directly

Ported from OCR_invoice with all advanced improvements:
  - 300 DPI rasterization (vs 150 DPI)
  - EXIF orientation correction
  - White border padding (prevents edge text cutoff by DBNet)
  - Image sharpening (makes faint/small text bolder)
  - Marginal text extraction at full resolution (captures tiny VAT IDs in headers/footers)
  - Rotation detection for landscape-scanned documents
  - Red-channel fallback for pink/highlighted invoices
  - Configurable PaddleOCR parameters (det_limit_side_len=4096, lower det thresholds)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional
import os

import fitz  # PyMuPDF, for rasterizing scanned PDF pages
import pdfplumber


@dataclass
class Token:
    text: str
    bbox: Tuple[float, float, float, float]  # x0, y0, x1, y1
    confidence: float


@dataclass
class PageResult:
    raw_text: str
    tokens: List[Token]
    avg_confidence: float
    is_native_text: bool = False          # True if no OCR was needed (real PDF text layer)
    page_images: Optional[List["object"]] = None  # rasterized numpy arrays, only set for OCR'd pages


# Lazy singleton so we only load the model once per process.
_paddleocr_instance = None


def _get_paddleocr():
    global _paddleocr_instance
    if _paddleocr_instance is None:
        from paddleocr import PaddleOCR
        # Use standard PaddleOCR for lightweight text extraction (avoid OOM from PPStructure)
        # We increase det_limit_side_len to 4096 so that the image isn't heavily downscaled,
        # which prevents the OCR from completely missing tiny marginal text.
        _paddleocr_instance = PaddleOCR(
            use_angle_cls=True,
            use_doc_unwarping=True,
            lang="es",
            det_limit_side_len=4096,
            det_db_thresh=0.2,
            det_db_box_thresh=0.4,
            det_db_unclip_ratio=2.0
        )
    return _paddleocr_instance


def _run_paddle_on_image_bytes(image_bytes: bytes) -> PageResult:
    import numpy as np
    import cv2
    from PIL import Image, ImageOps
    import io

    ocr = _get_paddleocr()

    try:
        # Load image and apply EXIF orientation to ensure it's not upside down
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)

        # Add a white border to prevent text at the very edge from being cut off by DBNet
        border_size = 50
        pil_img = ImageOps.expand(pil_img, border=(border_size, border_size, border_size, border_size), fill='white')

        # Convert PIL to OpenCV BGR format
        if pil_img.mode == 'RGBA':
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGR)
        elif pil_img.mode == 'RGB':
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        else:
            img = cv2.cvtColor(np.array(pil_img.convert('RGB')), cv2.COLOR_RGB2BGR)
    except Exception:
        # Fallback to direct OpenCV decode if PIL fails
        img_array = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        border_size = 0

    # Sharpen the image to make faint/small text bolder before OCR
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpened = cv2.addWeighted(gray, 1.8, cv2.GaussianBlur(gray, (0, 0), 3), -0.8, 0)
    img = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)

    # Helper to extract tiny text from the margins at full resolution
    def get_marginal_texts(image, ocr_engine):
        h, w = image.shape[:2]
        # Top 20% split into 4 quadrants to capture tiny letterhead (upper-left, upper-right)
        # and Bottom 20% split left/right for footer VAT registry lines
        margin_h = int(h * 0.20)
        third_w = int(w * 0.5)
        if margin_h == 0 or third_w == 0:
            return ""
        crops = [
            # Top strip - split into left and right halves
            image[0:margin_h, 0:third_w],
            image[0:margin_h, third_w:w],
            # Bottom strip - split into left and right halves
            image[h - margin_h:h, 0:third_w],
            image[h - margin_h:h, third_w:w]
        ]
        # Upscale crops by 1.9x to maximise resolution without hitting the 4000px limit
        crops = [cv2.resize(c, None, fx=1.9, fy=1.9, interpolation=cv2.INTER_CUBIC) for c in crops]
        marginal_texts = []
        for crop in crops:
            try:
                res = ocr_engine.predict(crop)
                if not res or not res[0]:
                    continue
                res0 = res[0]
                if hasattr(res0, 'get') and res0.get("rec_texts") is not None:
                    texts = res0.get("rec_texts", [])
                    marginal_texts.extend(texts)
                else:
                    for line in res0:
                        marginal_texts.append(line[1][0])
            except Exception:
                pass
        return " ".join(marginal_texts)

    margin_text = get_marginal_texts(img, ocr)

    result = ocr.predict(img)

    def get_char_count(res):
        if not res or not res[0]:
            return 0
        if hasattr(res[0], 'get') and res[0].get("rec_texts") is not None:
            return sum(len(t) for t in res[0].get("rec_texts", []))
        return sum(len(line[1][0]) for line in res[0])

    c_raw = get_char_count(result)

    # Fallback: if very little text is found, it might be heavily obscured by colored highlighter (e.g. pink)
    # The Red channel effectively erases pink/red markers while keeping black text visible.
    if c_raw < 250:
        b, g, r = cv2.split(img)
        r_bgr = cv2.cvtColor(r, cv2.COLOR_GRAY2BGR)
        result_r = ocr.predict(r_bgr)
        if get_char_count(result_r) > c_raw * 1.5:
            result = result_r

    if not result or not result[0]:
        return PageResult(raw_text="", tokens=[], avg_confidence=0.0, is_native_text=False)

    res0 = result[0]

    # Handle both old PaddleOCR lists and new PaddleX 3.0 dict-like objects
    if hasattr(res0, 'get') and res0.get("rec_texts") is not None:
        polys = res0.get("dt_polys", [])
        texts = res0.get("rec_texts", [])
        scores = res0.get("rec_scores", [])
        lines = []
        for p, t, s in zip(polys, texts, scores):
            lines.append([p, [t, s]])
    else:
        lines = res0

    if not lines:
        return PageResult(raw_text="", tokens=[], avg_confidence=0.0, is_native_text=False)

    # Detect if the document is rotated (landscape scan)
    horizontal_count = 0
    vertical_count = 0
    for line in lines:
        p = line[0]  # polygon
        xs = [pt[0] for pt in p]
        ys = [pt[1] for pt in p]
        if (max(xs) - min(xs)) > (max(ys) - min(ys)):
            horizontal_count += 1
        else:
            vertical_count += 1

    is_rotated = vertical_count > horizontal_count

    if is_rotated:
        # Rotated 90 degrees clockwise (or counter-clockwise)
        # Group by rough X-coordinate instead of Y, and sort within the group by Y
        lines.sort(key=lambda x: (round(x[0][0][0] / 25) * 25, x[0][0][1]))

        text_lines = []
        current_line = []
        current_axis = None

        for line in lines:
            axis_val = round((line[0][0][0] - border_size) / 25) * 25
            if current_axis is None:
                current_axis = axis_val
            if axis_val != current_axis:
                text_lines.append(" ".join(current_line))
                current_line = []
                current_axis = axis_val
            current_line.append(line[1][0])

        if current_line:
            text_lines.append(" ".join(current_line))

        # Reverse the lines — 90 CW is the most common scanner rotation for Spanish invoices
        text_lines.reverse()
    else:
        # Normal vertical orientation
        # Sort bounding boxes top-to-bottom, left-to-right (grouping by rough Y-coordinate)
        lines.sort(key=lambda x: (round(x[0][0][1] / 25) * 25, x[0][0][0]))

        text_lines = []
        current_line = []
        current_axis = None

        for line in lines:
            axis_val = round((line[0][0][1] - border_size) / 25) * 25
            if current_axis is None:
                current_axis = axis_val
            if axis_val != current_axis:
                text_lines.append(" ".join(current_line))
                current_line = []
                current_axis = axis_val
            current_line.append(line[1][0])

        if current_line:
            text_lines.append(" ".join(current_line))

    raw_text = "\n".join(text_lines)

    # Append the marginal text at the end so the LLM doesn't miss the tiny headers/footers
    if margin_text:
        raw_text += f"\n\n--- Marginal Text (Full Resolution) ---\n{margin_text}"

    confs = [line[1][1] for line in lines]
    avg_conf = sum(confs) / len(confs) if confs else 0.0

    return PageResult(
        raw_text=raw_text,
        tokens=[],
        avg_confidence=avg_conf,
        is_native_text=False,
        page_images=[img]
    )


def _pdf_has_text_layer(pdf_path: str, min_chars: int = 30) -> bool:
    """Heuristic: if pdfplumber can pull a reasonable amount of text, treat
    the PDF as a native (non-scanned) document and skip OCR entirely."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_chars = sum(len(p.extract_text() or "") for p in pdf.pages)
        return total_chars >= min_chars
    except Exception:
        return False


def extract_text_pdf_native(pdf_path: str) -> PageResult:
    """Extract text from a native PDF using PyMuPDF word blocks.
    Words are sorted spatially (top-to-bottom, left-to-right) and grouped
    into lines by Y-proximity, preserving multi-column layout cleanly."""
    tokens: List[Token] = []
    page_texts: List[str] = []

    with fitz.open(pdf_path) as doc:
        for page in doc:
            # get_text("words") returns (x0,y0,x1,y1,word,block,line,word_no)
            words = page.get_text("words")
            if not words:
                continue

            # Sort top→bottom, left→right
            words.sort(key=lambda w: (round(w[1], 0), w[0]))

            lines: List[List] = []
            cur_line: List = []
            cur_y = round(words[0][1], 0)

            for w in words:
                wy = round(w[1], 0)
                if abs(wy - cur_y) > 8:   # new visual line
                    if cur_line:
                        lines.append(cur_line)
                    cur_line = [w]
                    cur_y = wy
                else:
                    cur_line.append(w)
            if cur_line:
                lines.append(cur_line)

            page_lines: List[str] = []
            for line in lines:
                line.sort(key=lambda w: w[0])   # left→right
                page_lines.append(" ".join(w[4] for w in line))
                for w in line:
                    tokens.append(Token(
                        text=w[4],
                        bbox=(w[0], w[1], w[2], w[3]),
                        confidence=100.0,
                    ))

            page_texts.append("\n".join(page_lines))

    raw = "\n\n".join(page_texts)
    return PageResult(raw_text=raw, tokens=tokens, avg_confidence=100.0,
                      is_native_text=True, page_images=None)


def _rasterize_pdf(pdf_path: str, dpi: int = 300) -> List["bytes"]:
    """Render each PDF page to a PNG image (in-memory) for OCR input.
    Using 300 DPI (vs 150) significantly improves text readability for small fonts."""
    images = []
    doc = fitz.open(pdf_path)
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    for page in doc:
        pix = page.get_pixmap(matrix=matrix)
        images.append(pix.tobytes("png"))
    doc.close()
    return images


def extract_text_scanned_pdf(pdf_path: str) -> PageResult:
    page_results = [_run_paddle_on_image_bytes(b) for b in _rasterize_pdf(pdf_path)]
    return _merge_pages(page_results)


def extract_text_image(image_path: str) -> PageResult:
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    return _run_paddle_on_image_bytes(image_bytes)


def _merge_pages(pages: List[PageResult]) -> PageResult:
    text = "\n".join(p.raw_text for p in pages)
    tokens = [t for p in pages for t in p.tokens]
    confs = [p.avg_confidence for p in pages if p.avg_confidence]
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    images = [img for p in pages if p.page_images for img in p.page_images]
    return PageResult(raw_text=text, tokens=tokens, avg_confidence=avg_conf,
                      is_native_text=False, page_images=images or None)


def build_invoice_markdown(raw_text: str) -> str:
    """Convert raw spatially-sorted invoice text into structured Markdown.

    Produces:
      # Invoice
      ## Supplier
      ## Customer
      ## Items  (markdown table)
      ## Totals
    """
    import re

    lines = [l.rstrip() for l in raw_text.splitlines()]

    # ── helpers ──────────────────────────────────────────────────────────
    SEP = re.compile(r'^-{20,}$')
    # Line 1: code + description    e.g. '075963 MUTTI tomate passata botella 700 g'
    ITEM_DESC = re.compile(r'^(\d{5,7})\s+(.+)$')
    # Line 2: unit + numbers         e.g. 'BT 4,010 1 4,01 4 16,04 1'
    ITEM_NUMS = re.compile(
        r'^([A-Z]{2,3})\s+([\d,\.]+)\s+(\d+)\s+([\d,\.]+)\s+(\d+)\s+([\d,\.]+)'
    )
    PEDIDO_LINE = re.compile(r'\*\*\*\s*(Número|Fin de número)', re.I)

    def es_num(s: str) -> str:
        """Convert Spanish decimal '1.234,56' -> '1234.56' string."""
        return s.replace('.', '').replace(',', '.')

    # ── classify lines ───────────────────────────────────────────────────
    supplier_lines: List[str] = []
    customer_lines: List[str] = []
    item_rows: List[str] = []
    total_lines: List[str] = []
    doc_number: str = ""
    doc_date: str = ""
    doc_type: str = ""

    in_customer = False
    after_first_sep = False
    in_items = False
    in_totals = False
    separator_count = 0

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line:
            continue

        if SEP.match(line):
            separator_count += 1
            if separator_count == 1:
                after_first_sep = True
                in_customer = True
            elif separator_count == 2:
                in_customer = False
                # may be a column-header sep — next sep will start items
            elif separator_count == 3:
                in_items = True
            elif separator_count >= 4:
                in_items = False
                in_totals = True
            continue

        # Header block (before first separator): supplier + doc info
        if not after_first_sep:
            # Document type line: contains 'Factura', 'Albarán', 'Pedido' etc.
            dt = re.match(r'^(Factura|Albar[aá]n|Pedido|Invoice|Recibo)', line, re.I)
            if dt and not doc_type:
                doc_type = dt.group(1)
                # Document number often follows on same line or next non-empty
                rest = line[dt.end():].strip()
                if rest and not re.match(r'de\s+entrega', rest, re.I):
                    doc_number = rest.split()[0] if rest.split() else ""
                continue

            # Date lines
            if re.search(r'Fecha\s*(de\s*venta|impresión)?\s*:\s*\d', line, re.I):
                m = re.search(r'(\d{2}/\d{2}/\d{4})', line)
                if m and not doc_date:
                    d, mo, y = m.group(1).split('/')
                    doc_date = f"{y}-{mo}-{d}"
                continue

            # Skip date, NIF, Reg.Merc, Telf/Fax, Página noise
            if re.match(r'(NIF|Reg\.?\s*Merc|Telf|Fax)', line, re.I):
                continue
            if re.search(r'Fecha\s*(de\s*venta|impresi)', line, re.I):
                continue
            # Remove trailing 'Página: N' from supplier name line
            line = re.sub(r'\s+Página:\s*\d+$', '', line).strip()
            # Skip 'Factura de entrega' sub-header
            if re.match(r'Factura\s+de\s+entrega', line, re.I):
                continue
            if line:
                supplier_lines.append(line)
            continue

        # Customer block (between sep 1 and sep 2)
        if in_customer:
            # Skip N.I.F. line – it's the buyer's tax id, keep if useful
            if re.match(r'(N\.?I\.?F\.?|NIF)', line, re.I):
                customer_lines.append(line)
            elif not re.search(r'Num\.\s*art', line, re.I):  # skip column header
                customer_lines.append(line)
            continue

        # Items block: two-line format — desc line then numbers line
        if in_items:
            # Skip order meta lines
            if PEDIDO_LINE.match(line) or re.match(r'Entregado\s+a:', line, re.I):
                continue
            # Skip column header line
            if re.search(r'Num\.\s*art|Descrip\.\s*art|Cont\s+Prec', line, re.I):
                continue

            m_desc = ITEM_DESC.match(line)
            if m_desc:
                code, desc = m_desc.group(1), m_desc.group(2).strip()
                # consume next line for numbers
                if i < len(lines):
                    num_line = lines[i].strip()
                    m_nums = ITEM_NUMS.match(num_line)
                    if m_nums:
                        unit, _gross, _cont, unit_price, qty, amount = m_nums.groups()
                        i += 1
                        item_rows.append(
                            f"| {code} | {desc} | {qty} | {unit} | {es_num(unit_price)} | {es_num(amount)} |"
                        )
            continue

        # Totals block
        if in_totals:
            if line and not re.match(r'^-{3,}$', line):
                total_lines.append(line)
            continue

    # ── parse totals ─────────────────────────────────────────────────────
    subtotal = iva_total = grand_total = ""
    for line in total_lines:
        nums = re.findall(r'[\d]+[,\.][\d]+', line)
        if re.search(r'Total\s*a\s*pagar|Grand\s*Total', line, re.I) and nums:
            grand_total = es_num(nums[-1])
        elif re.search(r'Importe|Subtotal', line, re.I) and nums and not subtotal:
            subtotal = es_num(nums[-1])

    # Last two standalone numbers are often subtotal + iva on same line
    for line in total_lines:
        parts = line.strip().split()
        nums = [p for p in parts if re.match(r'^[\d,\.]+$', p)]
        if len(nums) >= 2 and not subtotal:
            subtotal = es_num(nums[-2])
            iva_total = es_num(nums[-1])

    # ── assemble Markdown ────────────────────────────────────────────────
    md: List[str] = []
    md.append("# Invoice")
    md.append("")
    md.append(f"**Type:** {doc_type or 'Factura'}  ")
    if doc_number:
        md.append(f"**Number:** {doc_number}  ")
    if doc_date:
        md.append(f"**Date:** {doc_date}  ")

    md.append("")
    md.append("## Supplier")
    md.append("")
    for sl in supplier_lines:
        md.append(sl)

    md.append("")
    md.append("## Customer")
    md.append("")
    for cl in customer_lines:
        md.append(cl)

    if item_rows:
        md.append("")
        md.append("## Items")
        md.append("")
        md.append("| Code | Description | Qty | Unit | Unit Price | Amount |")
        md.append("|------|-------------|-----|------|------------|--------|")
        md.extend(item_rows)

    md.append("")
    md.append("## Totals")
    md.append("")
    if subtotal:
        md.append(f"Subtotal: {subtotal}")
    if iva_total:
        md.append(f"VAT: {iva_total}")
    if grand_total:
        md.append(f"**Total: {grand_total}**")
    else:
        # Fallback: dump raw total lines
        for tl in total_lines:
            md.append(tl)

    return "\n".join(md)


def ingest(file_path: str) -> PageResult:
    """Main entry point. Routes the file to the right extraction path."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        if _pdf_has_text_layer(file_path):
            result = extract_text_pdf_native(file_path)
        else:
            result = extract_text_scanned_pdf(file_path)
    elif ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"):
        result = extract_text_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return result