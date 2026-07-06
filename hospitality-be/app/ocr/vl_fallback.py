"""
vl_fallback.py
==============
Stage 2.5: Vision-Language model fallback for low confidence OCR or LLM failure.
"""

from __future__ import annotations
import os
import json
import base64
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("invoice_pipeline")
logger.setLevel(logging.INFO)

from openai import OpenAI
from app.ocr.schema import Invoice, LABELS, LINE_ITEM_HEADERS
from app.ocr.validate import REQUIRED_FIELDS
from app.ocr.llm_fallback import (
    SCHEMA_DESCRIPTION,
    SYSTEM_PROMPT,
    _build_bilingual_dictionary,
    merge_llm_result_into_invoice
)

# VL Model configs
VL_MODEL = os.environ.get("VL_MODEL", "meta/llama-3.2-90b-vision-instruct")
VL_BASE_URL = os.environ.get("VL_BASE_URL", "https://integrate.api.nvidia.com/v1")
VL_API_KEY = os.environ.get("VL_API_KEY", os.environ.get("GEMINI_API_KEY", "")).strip()
VL_MAX_TOKENS = int(os.environ.get("VL_MAX_TOKENS", 8192))

# NVIDIA fallback config
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "").strip()
NVIDIA_VL_MODEL = os.environ.get("NVIDIA_VL_MODEL", "mistralai/ministral-14b-instruct-2512")
NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

VL_OCR_THRESHOLD = float(os.environ.get("VL_OCR_THRESHOLD", 0.80))
VL_LLM_THRESHOLD = float(os.environ.get("VL_LLM_THRESHOLD", 0.80))

_client = OpenAI(base_url=VL_BASE_URL, api_key=VL_API_KEY)
_nvidia_client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=NVIDIA_API_KEY) if NVIDIA_API_KEY else None


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
    
    # Deduct penalty for math/validation errors
    math_reasons = [r for r in temp_inv.review_reasons if not r.startswith("Missing ")]
    num_reasons = len(math_reasons)
    penalty = min(num_reasons * 0.25, 1.0) # Deduct 25% per math error
    
    # Deduct massive penalty if NO valid line items were extracted (must have product or quantity)
    valid_items = [li for li in inv.items if li.product or li.quantity] if inv.items else []
    if not valid_items:
        logger.info("No valid line items extracted (missing product/quantity). Applying 50% penalty to LLM score.")
        penalty += 0.50
        
    final_initial_score = max(success_rate - penalty, 0.0)
    inv.llm_confidence = final_initial_score
    return final_initial_score


def should_trigger_vl_fallback(ocr_confidence: Optional[float], inv: Invoice) -> bool:
    """Determine if VL fallback should be triggered based on OCR confidence or LLM success rate."""
    if not VL_API_KEY:
        logger.info("VL_API_KEY not set, skipping VL fallback check.")
        return False

    # Check OCR confidence threshold
    if ocr_confidence is not None and ocr_confidence < VL_OCR_THRESHOLD:
        logger.info(f"Triggering VL fallback: OCR confidence {ocr_confidence:.2f} < {VL_OCR_THRESHOLD}")
        return True
        
    final_initial_score = calculate_llm_score(inv)
    
    if final_initial_score < VL_LLM_THRESHOLD:
        logger.info(f"Triggering VL fallback: LLM Score {final_initial_score:.2f} < {VL_LLM_THRESHOLD}.")
        return True

    return False


def extract_with_vl_model(image_bytes: bytes, missing_fields: Optional[list] = None) -> dict:
    """Calls VL model and returns a parsed dict matching the schema."""
    if not image_bytes:
        raise ValueError("Image bytes are required for VL extraction")

    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    # Build explicit vision prompt with a concrete example (NOT type annotations)
    # Nemotron echoes back "string|null" literally if given a schema, so we use a filled example instead
    example_json = '''{
  "serialNumber": "INV-001",
  "type": "Invoice",
  "date": "2026-06-09",
  "subtotal": 34.96,
  "tax": 3.28,
  "total": 38.24,
  "supplier": {
    "name": "Supplier Company Name",
    "legalName": "Supplier Legal S.L.",
    "vatID": "B12345678",
    "address": "Street, City"
  },
  "items": [
    {"providerCode": "CODE1", "product": "Product Name", "quantity": 2.0, "unit": "und", "grossPrice": 12.70, "iva_pct": 10, "base": 25.40}
  ],
  "taxBrackets": [
    {"taxRate": 10, "subtotal": 31.40, "tax": 3.14, "total": 34.54}
  ]
}'''

    user_prompt = f"""
You are an expert AI data extraction system.
Extract all relevant fields from the provided invoice image.
Format your output EXACTLY according to the JSON schema below.
DO NOT use markdown formatting outside the JSON block.
DO NOT add explanatory text.
DO NOT use ellipses (...) or truncate any data. You MUST output every line item fully.
Return ONLY a single valid JSON block enclosed in ```json and ```.

<SCHEMA_REQUIREMENTS>
{SCHEMA_DESCRIPTION}
</SCHEMA_REQUIREMENTS>

Look at this invoice/delivery-note image. Extract ALL data you see directly from the image.\n
Return a single JSON object following this structure (replace example values with real ones from the image):\n\n
{example_json}\n\n
CRITICAL RULES:\n
1. supplier.name = the company/vendor name printed on the document header or logo (e.g., 'The Store Name', 'BBVA'). Do NOT use the customer/client name (e.g., 'REC 67 PARTNERS S.L.').\n
2. supplier.vatID = Look for the supplier's NIF/CIF (e.g. in the footer, header, or side margins like 'C.I.F. - A...'). Do NOT extract the client's NIF/CIF (which is usually next to the client's name or 'CLIENTE:').
3. document_number = Look for 'Albarà', 'Factura', 'Ticket', or 'Nº'. NEVER use a currency amount (like '3.58') as the document number.\n
4. date = Look for 'Data', 'Fecha', or 'Date'. Format as YYYY-MM-DD.\n
5. items = Extract EVERY SINGLE ITEM individually. DO NOT combine them. For each item, extract its specific line price. Do NOT mistakenly use the invoice total as the item price.\n
6. taxBrackets = You MUST extract the VAT/Tax breakdown (Resumen IVA, Base Imponible, Tipo IVA, Cuota IVA) usually found at the bottom of the invoice.\n
7. Return ONLY valid JSON starting with {{ and ending with }}. Do not output any conversational text, reasoning, or `<think>` blocks.\n
8. Use real values from the image, NOT the example placeholder values above.\n
9. CRITICAL: Distinguish carefully between the SUPPLIER (who issued the receipt) and the CUSTOMER (the buyer). Only extract the SUPPLIER's VAT ID (CIF/NIF) and Name. If you see 'CLIENTE:' or 'REC 67 PARTNERS', that is the customer, NOT the supplier.\n
10. EXTREMELY IMPORTANT: Pay close attention to the difference between the GRAND TOTAL ("TOTAL ALBARAN", "TOTAL FACTURA") and the totals of individual tax brackets. Do NOT confuse a tax bracket total (e.g. 58.08) for the grand total if there is a clear "TOTAL" line at the bottom (e.g. 82.72). Make sure subtotal + tax = total!"""

    if missing_fields:
        user_prompt += f"\n\nPrevious extraction MISSED these fields: {', '.join(missing_fields)} — pay extra attention to finding them."


    dynamic_system_prompt = SYSTEM_PROMPT + "\n" + _build_bilingual_dictionary()

    messages = [
        {"role": "system", "content": dynamic_system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                }
            ]
        }
    ]

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
        logger.warning(f"Primary Vision Model ({NVIDIA_VL_MODEL}) extraction completed successfully.")
    except Exception as e:
        logger.warning(f"Primary VL model ({NVIDIA_VL_MODEL}) failed: {e}. Falling back to {VL_MODEL}...")
        
        # Fallback to standard client (Gemini/OpenAI)
        logger.warning(f"Starting Secondary Vision Model extraction using: {VL_MODEL}...")
        response = _client.chat.completions.create(
            model=VL_MODEL,
            temperature=0,
            messages=messages,
            max_tokens=VL_MAX_TOKENS,
        )
        message = response.choices[0].message
        raw_content = (message.content or "").strip() if message else ""
        logger.warning(f"Secondary Vision Model ({VL_MODEL}) extraction completed successfully.")

    if not raw_content:
        logger.error("VL model returned an empty response — model may not support vision for this input.")
        raise ValueError("VL model returned an empty response")

    # Strip markdown fences if present
    content = raw_content
    
    # Strip <think> blocks (often produced by reasoning models like nemotron-3-nano-omni-30b-a3b-reasoning)
    import re
    content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

    if content.startswith("```"):
        # Remove opening fence line
        content = content.lstrip("`")
        if content.startswith("json"):
            content = content[4:]
        content = content.lstrip("\n")
        # Remove closing fence
        if content.endswith("```"):
            content = content[:-3].rstrip()

    # Extract the JSON object
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end >= start:
        content = content[start:end + 1]
    else:
        logger.error(f"VL model response contains no JSON object. Raw: {raw_content[:300]}")
        raise ValueError("VL model response contains no JSON object")

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"VL model returned invalid JSON (no repair attempted): {e}. Content: {content[:300]}")
        raise RuntimeError(f"VL model returned invalid JSON: {e}")

