"""
vl_fallback.py
==============
Stage 2.5: Vision-Language model fallback for low confidence OCR or LLM failure.
"""

from __future__ import annotations
import os
import io
import re
import json
import base64
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("invoice_pipeline")

from openai import OpenAI
from app.ocr.schema import Invoice, LABELS, LINE_ITEM_HEADERS
from app.ocr.validate import REQUIRED_FIELDS
from app.ocr.llm_fallback import (
    SCHEMA_DESCRIPTION,
    SYSTEM_PROMPT,
    _build_bilingual_dictionary,
    merge_llm_result_into_invoice
)

# Pillow is required for the preprocessing step below.
from PIL import Image, ImageOps

# pytesseract is optional — used only for orientation detection (OSD).
# If it isn't installed, or the tesseract binary isn't on PATH, we just
# skip OSD-based rotation and rely on EXIF transpose only.
try:
    import pytesseract
    _HAS_TESSERACT = True
except ImportError:
    pytesseract = None
    _HAS_TESSERACT = False

# VL Model configs
VL_MODEL = os.environ.get("VL_MODEL", "gemini-3.1-flash-lite")
VL_BASE_URL = os.environ.get("VL_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
VL_API_KEY = os.environ.get("VL_API_KEY", "").strip()
VL_MAX_TOKENS = int(os.environ.get("VL_MAX_TOKENS", 8192))

# NVIDIA fallback config
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "").strip()
NVIDIA_VL_MODEL = os.environ.get("NVIDIA_VL_MODEL", "mistralai/ministral-14b-instruct-2512")
NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

VL_OCR_THRESHOLD = float(os.environ.get("VL_OCR_THRESHOLD", 0.80))
VL_LLM_THRESHOLD = float(os.environ.get("VL_LLM_THRESHOLD", 0.80))

# Max longest-edge dimension before we downscale (keeps token/cost sane on
# huge phone photos without hurting legibility of invoice text).
VL_MAX_IMAGE_DIM = int(os.environ.get("VL_MAX_IMAGE_DIM", 1200))

_client = OpenAI(base_url=VL_BASE_URL, api_key=VL_API_KEY, max_retries=0)
_nvidia_client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=NVIDIA_API_KEY, max_retries=0) if NVIDIA_API_KEY else None


def calculate_llm_score(inv: Invoice) -> float:
    from app.ocr.validate import validate
    import copy
    
    # Run a temporary validation check to see if the current extraction fails arithmetic
    temp_inv = copy.deepcopy(inv)
    temp_inv = validate(temp_inv, raw_text="")
    
    # Calculate LLM extraction success rate
    total_required = len(REQUIRED_FIELDS)
    if total_required == 0:
        return 1.0
        
    found_count = sum(1 for _, getter in REQUIRED_FIELDS if getter(inv))
    success_rate = found_count / total_required
    
    # Deduct penalty for math/validation errors (ignoring "Missing..." which is already in success_rate)
    math_reasons = [r for r in temp_inv.review_reasons if not r.startswith("Missing ")]
    num_reasons = len(math_reasons)
    penalty = min(num_reasons * 0.15, 1.0) # Deduct 15% per math error
    
    # Deduct massive penalty if NO line items were extracted!
    if not inv.items or len(inv.items) == 0:
        logger.info("No line items extracted. Applying 50% penalty to LLM score.")
        penalty += 0.50
    else:
        # Check if line items are missing qty or grossPrice/base
        missing_fields_penalty = 0.0
        for item in inv.items:
            if item.quantity is None:
                missing_fields_penalty += 0.05
            if item.grossPrice is None and item.base is None:
                missing_fields_penalty += 0.05
        
        if missing_fields_penalty > 0:
            logger.info(f"Line items missing key fields. Applying {missing_fields_penalty:.2f} penalty to LLM score.")
            penalty += missing_fields_penalty
            
    final_initial_score = max(success_rate - penalty, 0.0)
    inv.llm_confidence = final_initial_score
    return final_initial_score


def should_trigger_vl_fallback(ocr_confidence: Optional[float], inv: Invoice) -> bool:
    """Determine if VL fallback should be triggered based on OCR confidence or LLM success rate."""
    if not VL_API_KEY and not NVIDIA_API_KEY:
        logger.info("Neither VL_API_KEY nor NVIDIA_API_KEY is set, skipping VL fallback check.")
        return False

    # Check OCR confidence threshold
    if ocr_confidence is not None and ocr_confidence < VL_OCR_THRESHOLD:
        logger.info(f"Triggering VL fallback: OCR confidence {ocr_confidence:.2f} < {VL_OCR_THRESHOLD}")
        return True
        
    final_initial_score = calculate_llm_score(inv)
    
    if final_initial_score < VL_LLM_THRESHOLD:
        import logging
        logger = logging.getLogger("invoice_pipeline")
        logger.info(f"Triggering VL fallback: LLM Score {final_initial_score:.2f} < {VL_LLM_THRESHOLD}.")
        return True

    return False


def _detect_mime_type(image_bytes: bytes) -> str:
    """Sniff the real image format from magic bytes instead of assuming JPEG."""
    if image_bytes[:2] == b"\xff\xd8":
        return "image/jpeg"
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    if image_bytes[:4] in (b"II*\x00", b"MM\x00*"):
        return "image/tiff"
    if image_bytes[:12] == b"\x00\x00\x00\x18ftypheic" or image_bytes[4:12] == b"ftypheic":
        return "image/heic"
    return "image/jpeg"  # sane default; re-encoding below normalizes this anyway


def preprocess_image(image_bytes: bytes) -> tuple[bytes, str]:
    """
    Normalize an invoice photo before it goes to the VLM:
      1. Respect embedded EXIF orientation (phone photos are frequently
         stored "sideways" with an orientation tag rather than actually
         rotated pixels).
      2. Best-effort auto-rotate using Tesseract's orientation/script
         detection (OSD) when the image still looks sideways after step 1
         — this is what actually fixes the "rotated 90 degrees" cases,
         instead of leaving it to the VLM to read sideways text.
      3. Normalize color mode and re-encode as JPEG, so we always know
         the true mime type we're sending (fixes hardcoded image/jpeg
         being wrong for PNG/HEIC/WebP uploads).
      4. Downscale extremely large photos so we don't blow the model's
         effective resolution/token budget on a single image.

    Returns (processed_bytes, mime_type). On any failure, falls back to
    the original bytes + sniffed mime type so a preprocessing bug never
    blocks extraction entirely.
    """
    original_mime = _detect_mime_type(image_bytes)

    try:
        img = Image.open(io.BytesIO(image_bytes))

        # Step 1: EXIF-based orientation correction.
        img = ImageOps.exif_transpose(img)

        # Step 2: OSD-based rotation correction (catches cases with no
        # EXIF orientation tag at all, e.g. screenshots of photos, or
        # scans where the paper itself was physically rotated).
        if _HAS_TESSERACT:
            try:
                osd = pytesseract.image_to_osd(img)
                match = re.search(r"Rotate:\s*(\d+)", osd)
                if match:
                    angle = int(match.group(1))
                    if angle in (90, 180, 270):
                        # PIL rotates counter-clockwise; OSD "Rotate" is the
                        # clockwise correction needed, so negate it.
                        img = img.rotate(-angle, expand=True)
                        logger.info(f"Auto-rotated image by {angle} degrees based on OSD.")
            except Exception as osd_err:
                # Tesseract binary missing, image too low-contrast for OSD,
                # etc. Not fatal — we just skip this step.
                logger.info(f"OSD rotation detection skipped: {osd_err}")

        # Step 3: normalize mode and re-encode as JPEG.
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")

        # Step 4: downscale if huge (based on area, not longest edge, so long receipts aren't crushed)
        # Limit to ~1.5 megapixels (e.g. 1000x1500)
        max_area = 1500000
        current_area = img.size[0] * img.size[1]
        if current_area > max_area:
            scale_factor = (max_area / current_area) ** 0.5
            new_width = int(img.size[0] * scale_factor)
            new_height = int(img.size[1] * scale_factor)
            img = img.resize((new_width, new_height), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        return buf.getvalue(), "image/jpeg"

    except Exception as e:
        logger.warning(f"Image preprocessing failed ({e}); sending original bytes unmodified.")
        return image_bytes, original_mime


def _normalize_european_numbers(parsed: dict) -> dict:
    """
    Fix a common VL model mistake: reading European 3-decimal prices like
    '2.760' (meaning €2.76) as the integer 2760. We detect this by checking
    if top-level financial amounts are wildly inconsistent with each other
    and correcting the scale.

    Logic:
    - Collect the raw total, subtotal, tax from the model output.
    - Find the minimum non-zero among them; if total > min * 100, the model
      likely multiplied by 1000 somewhere. Divide all affected amounts by 1000.
    - Apply the same check to each line item's grossPrice and base.
    """
    def _candidates(*keys):
        return [parsed.get(k) for k in keys if parsed.get(k) and float(parsed.get(k)) > 0]

    total = parsed.get("total", 0) or 0
    subtotal = parsed.get("subtotal", 0) or 0
    tax = parsed.get("tax", 0) or 0

    # If ANY of the three top-level values are non-zero, use the smallest as reference
    top_vals = [v for v in [total, subtotal, tax] if v and v > 0]
    if not top_vals:
        return parsed

    min_top = min(top_vals)
    max_top = max(top_vals)

    # If the spread between max and min is > 100x, something is scaled wrong.
    # Example: total=3342.0, tax=0.62 → 3342/0.62 = 5390x → clear scale error.
    if max_top > 0 and min_top > 0 and (max_top / min_top) > 100:
        # The outlier big value is the one to scale down by 1000
        scale_fields = ["total", "subtotal", "tax"]
        for f in scale_fields:
            val = parsed.get(f)
            if val and float(val) > min_top * 100:
                logger.warning(
                    f"VL decimal scale correction: {f}={val} looks like it was read "
                    f"as integer (×1000). Dividing by 1000 → {round(float(val)/1000, 4)}"
                )
                parsed[f] = round(float(val) / 1000, 4)

        # Propagate to taxBrackets
        for bracket in parsed.get("taxBrackets", []):
            for bf in ("subtotal", "tax", "total"):
                bval = bracket.get(bf)
                if bval and float(bval) > min_top * 100:
                    bracket[bf] = round(float(bval) / 1000, 4)

    return parsed


def extract_with_vl_model(image_bytes: bytes, missing_fields: Optional[list] = None) -> dict:
    """Calls VL model and returns a parsed dict matching the schema."""
    if not image_bytes:
        raise ValueError("Image bytes are required for VL extraction")

    # Preprocess once, reuse the same normalized bytes for both the
    # primary and secondary model calls below.
    processed_bytes, mime_type = preprocess_image(image_bytes)
    base64_image = base64.b64encode(processed_bytes).decode('utf-8')

    # Build explicit vision prompt with a concrete example (NOT type annotations)
    example_json = '''{
  "serialNumber": "<string>",
  "type": "Invoice",
  "date": "YYYY-MM-DD",
  "subtotal": <float>,
  "tax": <float>,
  "total": <float>,
  "supplier": {
    "name": "<string>",
    "legalName": "<string>",
    "vatID": "<string>",
    "address": "<string>"
  },
  "items": [
    {
      "providerCode": "<string or empty>",
      "product": "<string>",
      "quantity": <float>,
      "unit": "<string or empty>",
      "grossPrice": <float>,
      "iva_pct": <integer>,
      "base": <float>
    }
  ],
  "taxBrackets": [
    {
      "taxRate": <integer>,
      "subtotal": <float>,
      "tax": <float>,
      "total": <float>
    }
  ]
}'''

    user_prompt = (
        "CRITICAL: YOUR ENTIRE RESPONSE MUST BE A SINGLE, VALID JSON OBJECT. "
        "You MUST start your response with a <think>...</think> block to reason through the image "
        "BEFORE outputting the JSON. After the </think> tag, output ONLY the raw JSON object. "
        "NO MARKDOWN FENCES. NO EXPLANATIONS OUTSIDE THE THINK BLOCK.\n\n"
        "Look at this invoice image carefully. There may be a small credit card receipt (BBVA/Mastercard) "
        "physically stapled on top — IGNORE IT ENTIRELY. Focus ONLY on the main underlying invoice document.\n\n"
        "=== STEP-BY-STEP THINKING REQUIRED ===\n"
        "Inside your <think> block, answer these questions before writing JSON:\n"
        "  STEP 1 — GRAND TOTAL: Find the explicitly printed grand total on the main invoice "
        "(e.g. 'Total 3,58 EU', 'Cobrat:3.58', 'TOTAL A PAGAR'). Write it down. "
        "This is your ground truth. Do NOT compute it yourself.\n"
        "  STEP 2 — COUNT LINE ITEMS: Count how many distinct product rows are in the table. "
        "Write the count. You MUST extract exactly that many items.\n"
        "  STEP 3 — DECIMAL FORMAT: Determine the decimal separator used. "
        "On Spanish invoices, '2.760' in the Importe/Amount column means €2.76 (three decimal places), "
        "NOT two-thousand-seven-hundred-sixty. '3,58' means €3.58. Verify: if unit_price × qty ≈ line_total, "
        "you have the right scale. Write down the scale you will use.\n"
        "  STEP 4 — MAP EACH ROW: For each product row, write: product_name | qty | unit_price | line_total\n\n"
        "=== JSON OUTPUT SCHEMA ===\n"
        f"Return a JSON object following this EXACT structure structure, replacing the `<type>` placeholders with real extracted values:\n\n"
        f"{example_json}\n\n"
        "=== RULES ===\n"
        "1. SUPPLIER vs CUSTOMER: The supplier is the company that ISSUED the invoice (usually the largest logo or text at the top or margins). "
        "Do NOT use watermarks as the supplier. The customer is who it was billed TO (often next to 'CLIENTE:' or 'NOMBRE:'). Do NOT swap them. Do NOT use the customer's NIF as the supplier VAT ID.\n"
        "2. GRAND TOTAL RULE: Use the printed grand total you found in STEP 1 as `total`. "
        "Do NOT recalculate it. Do NOT use a line item total as the invoice total.\n"
        "3. LINE ITEMS — NO COMBINING: Each printed product row = one separate object in the `items` array. "
        "Never merge two rows into one. Never use one product's name with another product's price.\n"
        "4. EUROPEAN DECIMALS: '2.760' = 2.76 (€), NOT 2760. '1.380' = 1.38, NOT 1380. "
        "'2.00' = 2 units, NOT 200. Verify every number: qty × unit_price must ≈ line_total.\n"
        "5. ARITHMETIC CHECK & COLUMN MAPPING: After mapping all rows, verify: sum(item.base) ≈ subtotal, "
        "subtotal + tax ≈ total. If not, re-read the image. Use table headers carefully! Quantity is under 'CANTIDAD'/'QTY'. Unit price is under 'PRECIO'/'PRICE'. Line total is under 'IMPORTE'/'TOTAL'. Do NOT use VAT% (like 4 or 10) as quantity.\n"
        "6. SPANISH/CATALAN LABELS: Document number (serialNumber) is often found under 'Factura', 'Albarà', 'Albarán', or 'Nº'. Extract it exactly as printed.\n"
        "7. SMALL PRINT VAT ID: The supplier's VAT ID (NIF/CIF) is often in tiny print at the bottom or written vertically along the margins (e.g., 'NIF B 12345678' or 'C.I.F. A-87654321'). Find it and extract it WITHOUT spaces or dashes (e.g., 'B12345678').\n"
        "8. ROTATED/SIDEWAYS: If the image appears rotated, read it sideways.\n"
        "9. EXPLICIT DISCOUNTS: If an item has a printed discount amount (e.g., under 'DTOS' or 'DTO'), extract its absolute value as a positive number into `appliedDiscount`. For example, if you see '-16,24' or '16.24', set `appliedDiscount: 16.24`.\n"
        "OUTPUT: After </think>, output ONLY the raw JSON. No markdown fences. No extra text."
    )

    if missing_fields:
        user_prompt += f"\n\nPrevious extraction MISSED these fields: {', '.join(missing_fields)} — pay extra attention to finding them."

    VL_SYSTEM_PROMPT = (
        "You are an expert Vision-Language Model (Mistral Pixtral / Gemini) specialized in extracting "
        "structured financial data directly from invoice and receipt images. "
        "You can read text in any orientation. You understand European number formats where '.' can be "
        "a decimal separator (NOT thousands separator) in 3-decimal amounts like '2.760' = 2.76. "
        "Do not invent information. Follow the JSON schema strictly. "
        "Always reason step-by-step inside <think>...</think> before outputting JSON."
    )

    dynamic_system_prompt = VL_SYSTEM_PROMPT + "\n" + _build_bilingual_dictionary()

    messages = [
        {"role": "system", "content": dynamic_system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}
                }
            ]
        }
    ]

    def parse_and_validate_json(raw_text: str) -> dict:
        """
        Parse and lightly validate the VL model response.
        
        IMPORTANT: This validator is intentionally LENIENT. We do NOT reject
        results just because supplier name or total is missing/zero — a partial
        result is always better than discarding everything and keeping bad LLM
        text-extraction output. We only hard-fail on genuinely unrecoverable
        issues (no JSON at all, or empty items array when products are visible).
        """
        content = raw_text
        # Strip <think> reasoning blocks — the model is instructed to reason
        # before JSON so we remove the reasoning to isolate the JSON.
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

        # Strip markdown fences if the model ignored our instruction
        if content.startswith("```"):
            content = content.lstrip("`")
            if content.startswith("json"):
                content = content[4:]
            content = content.lstrip("\n")
            if content.endswith("```"):
                content = content[:-3].rstrip()
        
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end >= start:
            content = content[start:end + 1]
        else:
            raise ValueError("No JSON object found in response")

        # Flag likely truncation (cut off mid-object) with a clearer error.
        if not content.rstrip().endswith("}"):
            raise ValueError(
                "Response does not end with '}' — likely truncated output; "
                "consider raising VL_MAX_TOKENS"
            )

        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError) as e:
            raise ValueError(f"Invalid JSON from VL model: {e}")

        # Only hard-fail if items array is completely absent (not even empty list returned)
        # An empty items array is suspicious but we pass it through with a warning.
        if "items" not in parsed:
            raise ValueError("VL model response has no 'items' key at all — likely wrong format")

        if not parsed.get("items"):
            logger.warning("VL model returned empty items array — partial result will be used")

        # Warn (but do NOT raise) for missing critical fields — the merge
        # logic in pipeline.py will handle gaps from prior extraction stages.
        supplier = parsed.get("supplier", {})
        if not supplier or not supplier.get("name") or str(supplier.get("name")).strip() == "":
            logger.warning("VL model: missing supplier name — will use prior stage value if available")

        if not parsed.get("total") or float(parsed.get("total") or 0) == 0.0:
            logger.warning("VL model: total is 0 or missing — will use prior stage value if available")

        # Apply European decimal normalization BEFORE returning
        parsed = _normalize_european_numbers(parsed)

        return parsed

    # --- Primary attempt (NVIDIA / Mistral Pixtral) ---
    primary_error: Optional[Exception] = None
    try:
        if not _nvidia_client:
            raise ValueError("NVIDIA_API_KEY is not set for primary VL model")

        logger.warning(f"Starting Primary Vision Model extraction using: {NVIDIA_VL_MODEL}...")
        response = _nvidia_client.chat.completions.create(
            model=NVIDIA_VL_MODEL,
            temperature=0,
            messages=messages,
            max_tokens=VL_MAX_TOKENS,
        )
        message = response.choices[0].message
        raw_content = (message.content or "").strip() if message else ""

        if not raw_content:
            raise ValueError("Primary VL model returned empty response")

        parsed_json = parse_and_validate_json(raw_content)
        logger.warning(f"Primary Vision Model ({NVIDIA_VL_MODEL}) extraction completed successfully.")
        return parsed_json

    except Exception as e:
        primary_error = e
        logger.warning(f"Primary VL model ({NVIDIA_VL_MODEL}) failed: {e}. Falling back to {VL_MODEL}...")

    # --- Secondary attempt (Gemini/OpenAI-compatible) ---
    # This is its own try/except so a failure here doesn't propagate
    # an uncaught exception — it degrades to a single informative error.
    try:
        logger.warning(f"Starting Secondary Vision Model extraction using: {VL_MODEL}...")
        response = _client.chat.completions.create(
            model=VL_MODEL,
            temperature=0,
            messages=messages,
            max_tokens=VL_MAX_TOKENS,
            response_format={"type": "json_object"},
        )
        message = response.choices[0].message
        raw_content = (message.content or "").strip() if message else ""

        if not raw_content:
            raise ValueError("Secondary VL model returned empty response")

        parsed_json = parse_and_validate_json(raw_content)
        logger.warning(f"Secondary Vision Model ({VL_MODEL}) extraction completed successfully.")
        return parsed_json

    except Exception as secondary_error:
        logger.error(
            f"Both VL models failed. Primary ({NVIDIA_VL_MODEL}): {primary_error} | "
            f"Secondary ({VL_MODEL}): {secondary_error}"
        )
        raise ValueError(
            f"VL extraction failed on both models. "
            f"Primary error: {primary_error}. Secondary error: {secondary_error}"
        ) from secondary_error