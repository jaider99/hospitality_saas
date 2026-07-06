"""
ingest.py
=========
Stage 0: turn a file (PDF or image, EN/ES, scanned or native) into:
  - raw_text: best-effort plain text
  - tokens: list of (text, x0, y0, x1, y1, confidence) for layout-aware steps
  - avg_confidence: average OCR confidence, 0.0-1.0 scale (1.0 for native PDF
    text — see note below)
  - low_conf_ratio: fraction of recognized tokens below a confidence cutoff
    (0.0 for native PDF text, since there's no OCR uncertainty there)
  - token_count: number of recognized text tokens on the page

CHANGE: avg_confidence used to be inconsistent — 0-1 scale for OCR'd pages
(average of PaddleOCR's rec_scores) but hardcoded 100.0 for native-text PDFs.
Both pipeline.py's logging (`* 100` everywhere) and triage.py's handwriting
heuristic assume a single 0-1 scale, so native PDFs were producing a
nonsensical 10000% in logs and would have broken the heuristic. Standardized
on 0-1 throughout. Also added low_conf_ratio/token_count to PageResult so
triage.looks_handwritten can use its full two-signal check instead of
falling back to average-confidence-only.

Decision tree:
  PDF with an extractable text layer -> use it directly (fast, free, 100% accurate)
  PDF without text layer (scanned)   -> rasterize pages -> PaddleOCR
  Image file (jpg/png/etc.)          -> PaddleOCR directly

Install:
    pip install paddleocr paddlepaddle pdfplumber pymupdf
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional
import os

import fitz  # PyMuPDF, for rasterizing scanned PDF pages
import pdfplumber

# Tokens with a recognition score below this count toward low_conf_ratio.
# Same value triage.py uses internally for its handwriting heuristic — kept
# here as the single source of truth, imported by triage.py rather than
# duplicated.
LOW_CONFIDENCE_CUTOFF = 0.55


@dataclass
class Token:
    text: str
    bbox: Tuple[float, float, float, float]  # x0, y0, x1, y1
    confidence: float


@dataclass
class PageResult:
    raw_text: str
    tokens: List[Token]
    avg_confidence: float           # 0.0-1.0 scale, always
    is_native_text: bool = False    # True if no OCR was needed (real PDF text layer)
    page_images: Optional[List["object"]] = None  # rasterized numpy arrays, only set for OCR'd pages
    low_conf_ratio: float = 0.0     # fraction of tokens below LOW_CONFIDENCE_CUTOFF
    token_count: int = 0            # number of recognized text tokens


# Lazy singleton so we only load the model once per process.
# A threading lock ensures that if two threads arrive simultaneously
# (before the first has finished loading), only one loads the model.
import threading
_paddleocr_instance = None
_paddleocr_lock = threading.Lock()


def _get_paddleocr():
    global _paddleocr_instance
    if _paddleocr_instance is None:
        with _paddleocr_lock:
            # Double-checked locking: re-check inside the lock in case another
            # thread already finished loading while we were waiting.
            if _paddleocr_instance is None:
                from paddleocr import PaddleOCR
                import logging
                logging.getLogger("invoice_pipeline").info(
                    "Loading PaddleOCR model into memory (one-time startup)..."
                )
                # NOTE: PaddleOCR 3.x API — parameter names were renamed.
                # ONNX backend is enabled via the PADDLE_PDX_INFER_BACKEND env var
                # (set to 'onnxruntime') instead of a constructor argument.
                # This preserves the ONNX speedup on machines where onnxruntime is installed
                # without crashing on machines where it is not available.
                import os
                in_docker = os.environ.get('IS_DOCKER', '0') == '1' or os.path.exists('/.dockerenv')
                if in_docker:
                    # Enable ONNX runtime backend for speedup (requires onnxruntime package)
                    os.environ.setdefault('PADDLE_PDX_INFER_BACKEND', 'onnxruntime')
                _paddleocr_instance = PaddleOCR(
                    use_angle_cls=True,             # properly initializes the angle classifier for rotated receipts
                    show_log=False,                 # Suppress verbose paddleocr warnings
                    ocr_version="PP-OCRv4",         # Latest open-source OCR models
                    use_doc_unwarping=False,
                    lang="latin",                    # 'latin' provides better support for Spanish accents, € signs, etc.
                    text_det_limit_side_len=1536,   # replaces det_limit_side_len
                    text_det_limit_type="max",       # replaces det_limit_type
                    text_det_thresh=0.2,             # replaces det_db_thresh
                    text_det_box_thresh=0.4,         # replaces det_db_box_thresh
                    text_det_unclip_ratio=1.4        # 1.4 (down from 1.6) prevents tight tabular columns from bleeding into a single box
                )
                logging.getLogger("invoice_pipeline").info(
                    "PaddleOCR model loaded successfully."
                )
    return _paddleocr_instance


def _run_paddle_on_image_bytes(image_bytes: bytes) -> PageResult:
    import numpy as np
    import cv2
    from PIL import Image, ImageOps
    import io

    ocr = _get_paddleocr()
    
    def _do_ocr(engine, image):
        if hasattr(engine, 'predict'):
            return engine.predict(image)
        else:
            return engine.ocr(image, cls=True)
    
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

    # Calculate aspect ratio
    h_init, w_init = img.shape[:2]

    # Receipts are almost always portrait. If width > height, it's rotated 90 or 270 degrees.
    # PaddleOCR's angle_cls only detects 0/180 degrees. By rotating it 90 degrees clockwise here, 
    # it becomes either upright (0) or upside-down (180). PaddleOCR will then auto-fix the 180!
    if w_init > h_init:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        h_init, w_init = img.shape[:2]

    aspect_ratio = max(h_init, w_init) / float(min(h_init, w_init)) if min(h_init, w_init) > 0 else 1.0

    # We used to apply aggressive sharpening here (cv2.addWeighted), but it 
    # destroyed very thin, tiny letterforms (like small CIF numbers in the header).
    # PaddleOCR's DBNet handles standard scans perfectly well without our manual sharpening.
    if len(img.shape) == 3:
        # DBNet often prefers 3-channel input anyway, we can just leave it as BGR,
        # but let's keep the existing format (it was converting to GRAY then back to BGR)
        # to minimize side effects, or just leave it as BGR.
        pass

    # Helper to extract tiny text from the margins at full resolution.
    # Runs TWO passes per crop:
    #   Pass 1 (standard): normal image at 2x upscale
    #   Pass 2 (binary boost): adaptive-binarized 2x upscale — reliably finds
    #       tiny faint text like "C.I.F. - A - 08064313" in invoice headers
    #       that the standard pass completely misses.
    def get_marginal_texts(image, ocr_engine):
        h, w = image.shape[:2]
        # Top 20% strip gets extra attention (supplier VAT/CIF is almost always there)
        margin_h = int(h * 0.20)
        margin_w = int(w * 0.15)
        # Cap the overlap to a sensible amount (e.g. 2000px max) so we don't feed huge crops
        overlap_w = min(int(w * 0.7), 2200)
        overlap_h = min(int(h * 0.6), 2000)
        if margin_h == 0 or margin_w == 0: return ""
        crops = [
            image[0:margin_h, 0:overlap_w].copy(),         # Top Left  ← most important (supplier header)
            image[0:margin_h, w-overlap_w:w].copy(),       # Top Right ← important (CIF often right-aligned)
            image[h-margin_h:h, 0:overlap_w].copy(),       # Bottom Left
            image[h-margin_h:h, w-overlap_w:w].copy(),     # Bottom Right
            image[0:overlap_h, 0:margin_w].copy(),         # Left Top
            image[h-overlap_h:h, 0:margin_w].copy(),       # Left Bottom
            image[0:overlap_h, w-margin_w:w].copy(),       # Right Top
            image[h-overlap_h:h, w-margin_w:w].copy()      # Right Bottom
        ]
        marginal_texts = []
        seen_texts = set()  # deduplicate across both passes

        def _run_ocr_on_crop(crop_img):
            """Run OCR and return list of text strings."""
            result_texts = []
            try:
                res = _do_ocr(ocr_engine, crop_img)
                if not res or not res[0]:
                    return result_texts
                res0 = res[0]
                if hasattr(res0, 'get') and res0.get("rec_texts") is not None:
                    result_texts = res0.get("rec_texts", [])
                else:
                    result_texts = [line[1][0] for line in res0]
            except Exception:
                pass
            return result_texts

        for i, crop in enumerate(crops):
            ch, cw = crop.shape[:2]
            if ch == 0 or cw == 0:
                continue

            # ── Pass 1: standard (upscale 2x for small images) ──
            if max(h, w) < 3000:
                pass1_img = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
            else:
                pass1_img = crop

            for t in _run_ocr_on_crop(pass1_img):
                if t and t not in seen_texts:
                    seen_texts.add(t)
                    marginal_texts.append(t)

            # ── Pass 2: binary boost — finds tiny/faint text like CIF numbers ──
            # Only run this expensive pass on the top 2 crops (supplier header/CIF area)
            # Running this on all 8 crops for large invoices takes > 70 seconds.
            if i < 2:
                # Convert to grayscale → upscale 2x → adaptive threshold → run OCR
                try:
                    gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
                    big = cv2.resize(gray_crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
                    # Sharpen before binarization to make thin letterforms crisp
                    big_sharp = cv2.addWeighted(big, 2.5, cv2.GaussianBlur(big, (0, 0), 2), -1.5, 0)
                    binary = cv2.adaptiveThreshold(
                        big_sharp, 255,
                        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
                        15, 10
                    )
                    pass2_img = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
                    for t in _run_ocr_on_crop(pass2_img):
                        if t and t not in seen_texts:
                            seen_texts.add(t)
                            marginal_texts.append(t)
                except Exception:
                    pass

        return " ".join(marginal_texts)

    # Margin text extraction moved down after rotation    # If the image exceeds PaddleOCR's internal max_side_limit (4000px), PaddleOCR will brutally squash it.
    # We must slice it into chunks to preserve full resolution for the detection and recognition models.
    h, w = img.shape[:2]
    if h > 4000:
        result = [[]]
        # Calculate how many slices we need to keep each slice under 4000px
        num_slices = int(np.ceil(h / 3800.0))  # use 3800 to leave room for overlap
        slice_h = h // num_slices
        for i in range(num_slices):
            y_start = i * slice_h
            # Add a 50px overlap so text on the boundary isn't cut in half
            y_end = min(h, (i + 1) * slice_h + 50)
            chunk = img[y_start:y_end, 0:w].copy()
            print("MAIN SLICE SHAPE:", chunk.shape)
            chunk_res = _do_ocr(ocr, chunk)
            if chunk_res and chunk_res[0]:
                res0 = chunk_res[0]
                if hasattr(res0, 'get') and res0.get("rec_texts") is not None:
                    # PaddleX 3.0 dict format
                    polys = res0.get("dt_polys", [])
                    texts = res0.get("rec_texts", [])
                    scores = res0.get("rec_scores", [])
                    for p, t, s in zip(polys, texts, scores):
                        # Shift Y coordinates
                        p_shifted = [[pt[0], pt[1] + y_start] for pt in p]
                        result[0].append([p_shifted, (t, s)])
                else:
                    # Old list format
                    for line in res0:
                        p, (t, s) = line
                        p_shifted = [[pt[0], pt[1] + y_start] for pt in p]
                        result[0].append([p_shifted, (t, s)])
    elif w > 4000:
        result = [[]]
        # Calculate how many slices we need to keep each slice under 4000px
        num_slices = int(np.ceil(w / 3800.0))
        slice_w = w // num_slices
        for i in range(num_slices):
            x_start = i * slice_w
            # Add a 50px overlap so text on the boundary isn't cut in half
            x_end = min(w, (i + 1) * slice_w + 50)
            chunk = img[0:h, x_start:x_end].copy()
            chunk_res = _do_ocr(ocr, chunk)
            if chunk_res and chunk_res[0]:
                res0 = chunk_res[0]
                if hasattr(res0, 'get') and res0.get("rec_texts") is not None:
                    # PaddleX 3.0 dict format
                    polys = res0.get("dt_polys", [])
                    texts = res0.get("rec_texts", [])
                    scores = res0.get("rec_scores", [])
                    for p, t, s in zip(polys, texts, scores):
                        # Shift X coordinates
                        p_shifted = [[pt[0] + x_start, pt[1]] for pt in p]
                        result[0].append([p_shifted, (t, s)])
                else:
                    # Old list format
                    for line in res0:
                        p, (t, s) = line
                        p_shifted = [[pt[0] + x_start, pt[1]] for pt in p]
                        result[0].append([p_shifted, (t, s)])
    else:
        result = _do_ocr(ocr, img)

    def get_char_count(res):
        if not res or not res[0]: return 0
        if hasattr(res[0], 'get') and res[0].get("rec_texts") is not None:
            return sum(len(t) for t in res[0].get("rec_texts", []))
        return sum(len(line[1][0]) for line in res[0])

    c_raw = get_char_count(result)

    # Fallback: if very little text is found, it might be heavily obscured by colored highlighter (e.g. pink)
    # The Red channel effectively erases pink/red markers while keeping black text visible.
    if c_raw < 250:
        b, g, r = cv2.split(img)
        r_bgr = cv2.cvtColor(r, cv2.COLOR_GRAY2BGR)
        result_r = _do_ocr(ocr, r_bgr)
        if get_char_count(result_r) > c_raw * 1.5:
            result = result_r
    
    if not result or not result[0]:
        return PageResult(raw_text="", tokens=[], avg_confidence=0.0, is_native_text=False,
                           low_conf_ratio=1.0, token_count=0)
    
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
        return PageResult(raw_text="", tokens=[], avg_confidence=0.0, is_native_text=False,
                           low_conf_ratio=1.0, token_count=0)
    
    # Detect rotation first (mostly-vertical bboxes = rotated scan)
    horizontal_count = sum(1 for l in lines if (max(pt[0] for pt in l[0]) - min(pt[0] for pt in l[0])) > (max(pt[1] for pt in l[0]) - min(pt[1] for pt in l[0])))
    vertical_count = len(lines) - horizontal_count
    # Require 70% supermajority to avoid flipping on borderline cases (old: >50%, very flaky)
    is_rotated = len(lines) > 0 and (vertical_count / len(lines)) > 0.70

    h_img, w_img = img.shape[:2]

    if is_rotated:
        def _get_x_center(line):
            xs = [pt[0] for pt in line[0]]
            return (min(xs) + max(xs)) / 2.0

        top_words = ["factura", "fecha", "cliente", "cif", "nif", "nombre", "s.a.", "s.l.", "tel", "tlf", "www"]
        bottom_words = ["total", "importe", "iva", "efectivo", "tarjeta", "cambio", "gracias", "visita"]
        
        top_x = []
        bottom_x = []
        for line in lines:
            text = line[1][0].lower()
            x_center = _get_x_center(line)
            if any(w in text for w in top_words):
                top_x.append(x_center)
            if any(w in text for w in bottom_words):
                bottom_x.append(x_center)
        
        avg_top = sum(top_x) / len(top_x) if top_x else (w_img / 2)
        avg_bottom = sum(bottom_x) / len(bottom_x) if bottom_x else (w_img / 2)
        
        import logging
        if avg_top > avg_bottom:
            logging.getLogger("invoice_pipeline").info("Detected sideways text (Clockwise). Rotating counter-clockwise to upright...")
            img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
        else:
            logging.getLogger("invoice_pipeline").info("Detected sideways text (Counter-clockwise). Rotating clockwise to upright...")
            img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

        res = _do_ocr(ocr, img)
        if not res or not res[0]:
            return PageResult(raw_text="", tokens=[], avg_confidence=0.0, is_native_text=False, low_conf_ratio=1.0, token_count=0)
        lines = [line for line in res[0] if line]
        
    # Extract marginal text NOW that the image is guaranteed upright
    margin_text = get_marginal_texts(img, ocr)
        
    # ── Table Extraction & Layout ──────────────────────────────────────────
    # Extract tables using PPStructure and filter out text inside tables
    table_bboxes = []
    table_htmls = []
    
    try:
        from app.ocr.table_extract import _get_pp_structure
        structure_engine = _get_pp_structure()
        
        # Use predict for 3.x, fallback to callable for 2.x
        if hasattr(structure_engine, "predict"):
            struct_res = structure_engine.predict(img)
        else:
            struct_res = structure_engine(img)
            
        for item in struct_res:
            table_list = None
            if isinstance(item, dict) and "table_res_list" in item:
                table_list = item["table_res_list"]
            elif hasattr(item, "table_res_list"):
                table_list = item.table_res_list
            elif hasattr(item, "get"):
                try: table_list = item.get("table_res_list")
                except Exception: pass
            
            if table_list:
                for t in table_list:
                    html = t.get("pred_html") if isinstance(t, dict) else getattr(t, "pred_html", None)
                    bbox = t.get("bbox") if isinstance(t, dict) else getattr(t, "bbox", None)
                    if html and bbox:
                        table_htmls.append(html)
                        table_bboxes.append(bbox)
                continue
                
            if isinstance(item, dict) and item.get("type") == "table":
                bbox = item.get("bbox")
                html = item.get("res", {}).get("html", "")
                if html and bbox:
                    table_htmls.append(html)
                    table_bboxes.append(bbox)
    except Exception as e:
        import logging
        logging.getLogger("invoice_pipeline").warning(f"PPStructure failed during ingest: {e}")

    def is_inside_box(pt, box):
        return box[0] <= pt[0] <= box[2] and box[1] <= pt[1] <= box[3]

    text_elements = []
    tokens = []
    confs = []
    for line in lines:
        pts = line[0]
        text = line[1][0]
        conf = line[1][1]
        
        x0 = min(pt[0] for pt in pts)
        y0 = min(pt[1] for pt in pts)
        x1 = max(pt[0] for pt in pts)
        y1 = max(pt[1] for pt in pts)
        tokens.append(Token(text=text, bbox=(x0, y0, x1, y1), confidence=conf))
        confs.append(conf)

        x_center = (x0 + x1) / 2
        y_center = (y0 + y1) / 2
        
        in_table = False
        for t_box in table_bboxes:
            if is_inside_box([x_center, y_center], t_box):
                in_table = True
                break
                
        if not in_table:
            text_elements.append({
                'text': text,
                'x': x_center,
                'y': y_center
            })

    def _detect_column_gap(elements, img_w):
        """Returns a split_x threshold if there is a clear column gap, or None."""
        if len(elements) < 10:
            return None
        x_centers = sorted([el['x'] for el in elements])
        gaps = [(x_centers[i+1] - x_centers[i], (x_centers[i] + x_centers[i+1]) / 2.0)
                for i in range(len(x_centers) - 1)]
        if not gaps:
            return None
        max_gap, gap_center = max(gaps, key=lambda g: g[0])
        mid_zone_lo = img_w * 0.30
        mid_zone_hi = img_w * 0.70
        avg_gap = sum(g[0] for g in gaps) / len(gaps)
        if max_gap > avg_gap * 3.5 and mid_zone_lo < gap_center < mid_zone_hi:
            return gap_center
        return None

    # Group and sort non-table text
    if text_elements:
        split_x = _detect_column_gap(text_elements, w_img)
        
        def _sort_and_group(elements):
            if not elements:
                return []
            elements.sort(key=lambda item: item['y'])
            sorted_lines = []
            current_line = [elements[0]]
            y_threshold = 15 # pixels threshold for same line
            for item in elements[1:]:
                if abs(item['y'] - current_line[-1]['y']) <= y_threshold:
                    current_line.append(item)
                else:
                    sorted_lines.append(current_line)
                    current_line = [item]
            if current_line:
                sorted_lines.append(current_line)
            
            text_lines_out = []
            for sl in sorted_lines:
                sl.sort(key=lambda item: item['x'])
                line_text = " \t ".join(item['text'] for item in sl)
                text_lines_out.append(line_text)
            return text_lines_out

        if split_x is not None:
            header_threshold = h_img * 0.45
            header_elements = [el for el in text_elements if el['y'] <= header_threshold]
            body_elements = [el for el in text_elements if el['y'] > header_threshold]
            
            left_header = [el for el in header_elements if el['x'] <= split_x]
            right_header = [el for el in header_elements if el['x'] > split_x]
            
            left_text = "\n".join(_sort_and_group(left_header))
            right_text = "\n".join(_sort_and_group(right_header))
            body_text = "\n".join(_sort_and_group(body_elements))
            
            raw_text = f"{left_text}\n\n--- DOCUMENT INFO COLUMN ---\n{right_text}\n\n--- INVOICE BODY ---\n{body_text}"
        else:
            raw_text = "\n".join(_sort_and_group(text_elements))
    else:
        raw_text = ""
        
    if table_htmls:
        raw_text = "\n\n".join(table_htmls) + "\n\n" + raw_text

    # Append the marginal text at the end so the LLM doesn't miss the tiny headers/footers
    if margin_text:
        raw_text += f"\n\n--- Marginal Text (Full Resolution) ---\n{margin_text}"

    avg_conf = sum(confs) / len(confs) if confs else 0.0
    token_count = len(confs)
    low_conf_ratio = (sum(1 for c in confs if c < LOW_CONFIDENCE_CUTOFF) / token_count) if token_count else 1.0

    return PageResult(
        raw_text=raw_text,
        tokens=tokens,
        avg_confidence=avg_conf,
        is_native_text=False,
        page_images=[img],
        low_conf_ratio=low_conf_ratio,
        token_count=token_count,
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
                        confidence=1.0,
                    ))

            page_texts.append("\n".join(page_lines))

    raw = "\n\n".join(page_texts)
    # Native PDF text layer: no OCR uncertainty, confidence is 1.0 (not 100.0
    # — see module docstring), low_conf_ratio is 0.0.
    return PageResult(raw_text=raw, tokens=tokens, avg_confidence=1.0,
                      is_native_text=True, page_images=None,
                      low_conf_ratio=0.0, token_count=len(tokens))


def _rasterize_pdf(pdf_path: str, dpi: int = 200) -> List["bytes"]:
    """Render each PDF page to a PNG image (in-memory) for OCR input.

    If a page has an embedded rotation transform (e.g. landscape Apple receipts
    stored at 90°), we counter-rotate the rendering matrix so PaddleOCR always
    receives an upright image.  For normal PDFs page.rotation == 0, so
    Matrix(...).prerotate(0) is a complete no-op — zero change for working invoices.
    """
    images = []
    doc = fitz.open(pdf_path)
    zoom = dpi / 72
    for page in doc:
        # page.rotation is 0, 90, 180, or 270.  Counter-rotate so text is upright.
        page_rotation = page.rotation  # degrees clockwise stored in the PDF

        # Dynamically scale down zoom for massive PDFs (like long iPhone screenshots) to prevent timeout
        # Cap at 3500px (equivalent to a massive ~300 DPI A4 page) so CPU processing finishes in <15s
        max_pt = max(page.rect.width, page.rect.height)
        page_zoom = zoom
        if max_pt * page_zoom > 3500:
            page_zoom = 3500.0 / max_pt

        matrix = fitz.Matrix(page_zoom, page_zoom).prerotate(-page_rotation)
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

    total_tokens = sum(p.token_count for p in pages)
    # Weighted average of per-page low_conf_ratio by each page's token count,
    # so a long, mostly-clean multi-page doc isn't dragged down by one tiny
    # noisy page (or vice versa).
    if total_tokens:
        weighted_low_conf = sum(p.low_conf_ratio * p.token_count for p in pages) / total_tokens
    else:
        weighted_low_conf = 1.0

    return PageResult(raw_text=text, tokens=tokens, avg_confidence=avg_conf,
                       is_native_text=False, page_images=images or None,
                       low_conf_ratio=weighted_low_conf, token_count=total_tokens)


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
            if re.match(r'(NIF|Reg\.\s*Merc|Telf|Fax)', line, re.I):
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