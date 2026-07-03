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
VL_MODEL = os.environ.get("VL_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
VL_BASE_URL = os.environ.get("VL_BASE_URL", "https://integrate.api.nvidia.com/v1")
VL_API_KEY = os.environ.get("NVIDIA_API_KEY", "").strip()
VL_MAX_TOKENS = int(os.environ.get("VL_MAX_TOKENS", 8192))

VL_OCR_THRESHOLD = float(os.environ.get("VL_OCR_THRESHOLD", 0.80))
VL_LLM_THRESHOLD = float(os.environ.get("VL_LLM_THRESHOLD", 0.80))

_client = OpenAI(base_url=VL_BASE_URL, api_key=VL_API_KEY)


def should_trigger_vl_fallback(ocr_confidence: Optional[float], inv: Invoice) -> bool:
    """Determine if VL fallback should be triggered based on OCR confidence or LLM success rate."""
    if not VL_API_KEY:
        logger.info("VL_API_KEY not set, skipping VL fallback check.")
        return False

    # Check OCR confidence threshold
    if ocr_confidence is not None and ocr_confidence < VL_OCR_THRESHOLD:
        logger.info(f"Triggering VL fallback: OCR confidence {ocr_confidence:.2f} < {VL_OCR_THRESHOLD}")
        return True
        
    # Check if the text-based LLM extraction is mathematically or structurally broken
    from app.ocr.validate import validate
    import copy
    
    # Run a temporary validation check to see if the current extraction fails arithmetic
    temp_inv = copy.deepcopy(inv)
    temp_inv = validate(temp_inv, raw_text="")
    
    # Calculate LLM extraction success rate
    total_required = len(REQUIRED_FIELDS)
    if total_required > 0:
        found_count = sum(1 for _, getter in REQUIRED_FIELDS if getter(inv))
        success_rate = found_count / total_required
        
        # Deduct penalty for math/validation errors
        num_reasons = len(temp_inv.review_reasons)
        penalty = min(num_reasons * 0.25, 1.0) # Deduct 25% per math error
        
        final_initial_score = max(success_rate - penalty, 0.0)
        inv.llm_confidence = final_initial_score
        
        if final_initial_score < VL_LLM_THRESHOLD:
            logger.info(f"Triggering VL fallback: GPT OSS Score {final_initial_score:.2f} < {VL_LLM_THRESHOLD}. (Math errors: {num_reasons})")
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

    user_prompt = (
        "Look at this invoice/delivery-note image. Extract ALL data you see directly from the image.\n"
        "Return a single JSON object following this structure (replace example values with real ones from the image):\n\n"
        f"{example_json}\n\n"
        "CRITICAL RULES:\n"
        "1. supplier.name = the company/vendor name printed on the document (NOT the customer name)\n"
        "2. items = EVERY row in the product table — do NOT leave this array empty\n"
        "3. Return ONLY valid JSON. No markdown fences. No explanations. No type annotations.\n"
        "4. Use real values from the image, NOT the example placeholder values above."
    )

    if missing_fields:
        user_prompt += f"\n\nPrevious extraction MISSED these fields: {', '.join(missing_fields)} — pay extra attention to finding them."


    dynamic_system_prompt = SYSTEM_PROMPT + "\n" + _build_bilingual_dictionary()

    response = _client.chat.completions.create(
        model=VL_MODEL,
        temperature=0,
        messages=[
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
        ],
        max_tokens=VL_MAX_TOKENS,
    )

    message = response.choices[0].message
    raw_content = (message.content or "").strip() if message else ""

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

