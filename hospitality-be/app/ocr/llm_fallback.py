"""
llm_fallback.py
================
Stage 2: LLM extraction fallback, used when:
  - regex stage left required fields as None, OR
  - validate.py's sanity checks fail, OR
  - OCR average confidence is below a threshold (likely garbled text)

Ported from OCR_invoice into hospitality-be/app/ocr/
API key is read from env LLM_API_KEY (or OPENAI_API_KEY).
Base URL and model are configurable via LLM_BASE_URL and LLM_MODEL env vars.
Defaults to OpenRouter with gpt-4o-mini.
"""

from __future__ import annotations
import json
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

from openai import OpenAI
from app.ocr.schema import OcrInvoice, IVABreakdownRow, LineItem, LABELS, LINE_ITEM_HEADERS, clean_extracted_text

# ---------------------------------------------------------------------------
# Config — reads from env vars lazily (at call time, not import time)
# This ensures .env is fully loaded before credentials are read.
# ---------------------------------------------------------------------------
_client_instance: OpenAI | None = None


def _get_client() -> OpenAI:
    """Lazy singleton for the OpenAI-compatible client."""
    global _client_instance
    if _client_instance is None:
        api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
        base_url = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
        if not api_key:
            raise RuntimeError(
                "No LLM API key found. Set LLM_API_KEY (or OPENAI_API_KEY) in your .env file."
            )
        _client_instance = OpenAI(base_url=base_url, api_key=api_key)
    return _client_instance


def _model() -> str:
    return os.environ.get("LLM_MODEL", "openai/gpt-4o-mini")


def _build_bilingual_dictionary() -> str:
    lines = ["\n=== BILINGUAL FIELD MAPPINGS ==="]
    lines.append("To help you map Spanish terms to the correct JSON field, use this dictionary:")
    for key, words in LABELS.items():
        lines.append(f"- {key}: {', '.join(words)}")
    lines.append("For Line Items:")
    for key, words in LINE_ITEM_HEADERS.items():
        lines.append(f"- line_items[].{key}: {', '.join(words)}")
    return "\n".join(lines)


SCHEMA_DESCRIPTION = """
Return ONLY valid JSON (no markdown fences, no commentary) matching this
exact structure. **CRITICAL: To save tokens, completely OMIT any field that is null or empty.**
Do not invent values. Numbers must be plain numbers (no currency symbols, use '.'
as the decimal separator regardless of source format):

{
  "general_info": {
    "document_type": string|null,
    "document_number": string|null,
    "date": "YYYY-MM-DD"|null,
    "category": string|null,
    "uploaded_by": string|null
  },
  "supplier": {
    "display_name": string|null,
    "legal_name": string|null,
    "tax_id": string|null,
    "address": string|null,
    "contact_count": number|null
  },
  "line_items": [
    {
      "provider_code": string|null,
      "product": string|null,
      "quantity": number|null,
      "unit": string|null,
      "gross_price": number|null,
      "discount_pct": number|null,
      "applied_discount": number|null,
      "other_fees": number|null,
      "nominal_price": number|null,
      "iva_pct": number|null,
      "base": number|null
    }
  ],
  "totals": {
    "base_amount": number,
    "iva_amount": number,
    "total_with_iva": number,
    "discount": number,
    "paye": number,
    "green_point": number,
    "ibee": number,
    "attributable_cost": number,
    "tax_free_costs": number,
    "iva_breakdown": [
      {"rate_pct": 4, "base": 3.56, "iva_amount": 0.14, "row_total": 3.70},
      {"rate_pct": 10, "base": 31.40, "iva_amount": 3.14, "row_total": 34.54}
    ]
  },
  "status": {
    "reconciliation_status": string,
    "payment_status": string
  },
  "currency": string
}
"""

SYSTEM_PROMPT = (
    "You are a precise invoice/delivery-note data-extraction engine. "
    "Documents are Spanish (albarán/factura/receipts). Map fields by MEANING, not label text.\n"
    "\n"
    "=== SUPPLIER vs CUSTOMER ===\n"
    "You must semantically deduce the Supplier vs the Customer. Do NOT rely solely on who appears at the top of the page.\n"
    "The SUPPLIER is the vendor providing the goods or services (e.g., if the line items are 'Copies', the printing company is the Supplier). They issue the invoice. Their name is often printed prominently (like a logo).\n"
    "The CUSTOMER is the client receiving and paying for the goods/services. They are often indicated by keywords like 'CLIENTE:', 'NOMBRE:', 'DIRECCIÓN:'.\n"
    "--- SUPPLIER KEYWORDS (English/Spanish): Supplier, Proveedor, Vendor, Vendedor, Seller, Sold By, Vendido por, Issuer, Emisor, Emisor de la factura, Company, Empresa, Merchant, Comerciante, From, De, Billed By, Facturado por, Service Provider, Prestador del servicio.\n"
    "--- CUSTOMER KEYWORDS (English/Spanish): Customer, Cliente, Client, Buyer, Comprador, Bill To, Facturar a, Invoice To, Sold To, Vendido a, Ship To, Enviar a, Delivery Address, Dirección de envío, Recipient, Destinatario, Purchaser, Billed To, Facturado a.\n"
    "--- VAT/TAX ID TERMS: VAT, VAT ID, VAT No., Tax ID, TIN, IVA, NIF, CIF, NIE, NIF/CIF, CIF/NIF, NIF-IVA, Número de IVA, C.I.F., N.I.F.\n"
    "CRITICAL: The 'supplier.tax_id' MUST be the NIF/CIF of the Vendor. If the document contains MULTIPLE tax IDs, carefully associate each ID with its respective company. Never extract the Customer's tax ID into the Supplier section.\n"
    "IMPORTANT HINT: The Supplier's NIF/CIF is sometimes printed in tiny text at the edge/margins of the document alongside their registry details (e.g., 'Registre Mercantil de Barcelona... C.I.F. - A 08064313'). If found there, it belongs to the Supplier.\n"
    "IMPORTANT HINT: If a CIF/NIF is listed directly beneath or next to any CUSTOMER KEYWORDS (e.g. labeled 'D.N.I./C.I.F: B67019018' near 'CLIENTE:'), that is the CUSTOMER's tax ID, NOT the Supplier's. DO NOT put the Customer's ID in `supplier.tax_id`.\n"
    "STRICT MISSING DATA RULE: If the Supplier's VAT ID is completely missing from the extracted text, you MUST output null for supplier.tax_id. NEVER guess, and NEVER use the Customer's VAT ID as a substitute!\n"
    "ABSOLUTE PROHIBITION: You must NEVER put the Customer's VAT ID into the supplier.tax_id field.\n"
    "=== GENERAL INFO ===\n"
    "DATE PARSING: Spanish/Catalan dates are DD/MM/YY or DD/MM/YYYY. "
    "The LAST number is always the year, the FIRST is always the day. "
    "E.g. '19/05/26' = day=19, month=05, year=2026. NEVER interpret "
    "the first 2-digit number as a year. Always output as ISO YYYY-MM-DD. "
    "Prefix 2-digit years with '20' (e.g., 26 -> 2026).\n"
    "DOCUMENT TYPE: Always use the EXACT label printed in the page header: "
    "'Albarán' (delivery note), 'Factura' (invoice), 'Recibo' (receipt), etc. "
    "Do NOT default to 'Invoice'.\n"
    "The 'document_number' is the unique ID of the invoice or receipt. "
    "It typically looks like: 'A26-004800', 'F2026-001', '2485/26', 'ALB-0012345'. "
    "NOT a hex hash like '676d82', NOT a barcode, NOT a date. "
    "Look for labels: Document, Documento, Nº, No., Nº Factura, Nº Albarán, Invoice No.\n"
    "\n"
    "=== TOTALS & IVA BREAKDOWN ===\n"
    "Source text is markdown — tables are preserved as | col | col | rows. "
    "If you see a multi-rate TAX table like:\n"
    "  | IVA 4% | 3.56 | 0.14 | 3.70 |\n"
    "  | IVA 10% | 31.40 | 3.14 | 34.54 |\n"
    "Extract EACH RATE as a separate object in totals.iva_breakdown with fields: "
    "{rate_pct, base, iva_amount, row_total}. "
    "DO NOT mix values from different rows!\n"
    "GRAND TOTAL RULE: The total_with_iva field must be the final Grand Total of the entire invoice. NEVER map a single line item's total to the invoice total_with_iva field.\n"
    "The overall base_amount MUST be the printed 'Subtotal' or 'BASE IMPONIBLE' (Total before tax).\n"
    "For 'total_with_iva': extract it ONLY from an explicit printed total field (e.g. 'IMPORTE ALBARÁN', 'TOTAL A PAGAR', 'Total (EUR)', 'TOTAL FACTURA').\n"
    "\n"
    "=== LINE ITEMS ===\n"
    "Each line item logically contains: [Code] [Description] [Qty] [Unit] [Price] [Base].\n"
    "ONLY extract actual products/services as line items. DO NOT extract additional fees, regulatory costs, credits, or adjustments as line items.\n"
    "CRITICAL: You MUST extract the Unit Price into `nominal_price` and the Total Amount (Qty * Price) into `base` for EVERY line item. Never omit them if they exist on the page.\n"
    "Always ensure EVERY extracted product gets its `base` and `iva_pct`.\n"
    "\n"
    "=== ADDITIONAL FEES & ADJUSTMENTS ===\n"
    "DISCOUNTS: A %Dto in line-items applies ONLY to that specific row. Never copy a line-item's discount to the document-level 'discount' field.\n"
    "CRITICAL: The `paye` field is for Income Tax Withholding (IRPF / Retenciones). DO NOT put 'Payments' or 'Pagado' amounts in paye!\n"
    "\n"
    "=== ARITHMETIC RULES ===\n"
    "DO NOT compute sums for base_amount or iva_amount. The pipeline does all arithmetic in Python. "
    "Your job is to find and return the raw values printed on the document. "
    "If a field is genuinely absent, completely OMIT it from the JSON to save output tokens.\n"
    "\n"
    "=== MARKDOWN & HEADER CLEANUP RULE ===\n"
    "CRITICAL: The document text you receive might be formatted with Markdown headers (e.g. '## Supplier', '**Supplier:**', '# Invoice'). "
    "You MUST NEVER extract these literal markdown headers or labels as value representations for JSON fields. "
    "For example, if you see '## Supplier\\nBeverage Source Ltd', the supplier display_name is 'Beverage Source Ltd', NOT '## Supplier' or 'Supplier'. "
    "Always extract the ACTUAL underlying name, date, or number, and strip any surrounding markdown syntax (like #, *, _, colons, or field labels).\n"
    "\n"
    "CRITICAL: DO NOT use <think> blocks. DO NOT provide any reasoning. Output ONLY the raw JSON immediately."
)


def extract_with_llm(raw_text: str, missing_fields: Optional[list] = None) -> dict:
    """Calls the LLM and returns a parsed dict matching the schema."""
    user_prompt = (
        f"{SCHEMA_DESCRIPTION}\n\n"
        f"Invoice Text:\n"
        f'"""\n{raw_text}\n"""\n\n'
        f"Extract ALL the invoice fields into the JSON schema provided."
    )
    if missing_fields:
        user_prompt += f"\n\nCRITICAL: The following fields are currently missing. Pay EXTRA attention to finding them in the text: {', '.join(missing_fields)}"

    dynamic_system_prompt = SYSTEM_PROMPT + "\n" + _build_bilingual_dictionary()

    client = _get_client()
    model = _model()
    response = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": dynamic_system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=8000,
    )

    message = response.choices[0].message
    if not message or not message.content:
        logger.error(f"LLM returned an empty response. Raw response: {response}")
        raise ValueError("LLM returned an empty response")

    content = message.content.strip()

    if content.startswith("```"):
        content = content.strip("`")
        content = content[content.find("{"):content.rfind("}") + 1]

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.warning(f"LLM JSON decode error: {e}. Attempting repair.")
        repair_prompt = (
            f"The following output is malformed JSON and must be corrected to match the schema: {SCHEMA_DESCRIPTION}\n"
            f"Malformed output:\n{content}\n\nPlease return ONLY valid JSON."
        )
        repair_resp = client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": repair_prompt},
            ],
            max_tokens=8000,
        )
        repaired = repair_resp.choices[0].message.content.strip()
        if repaired.startswith("```"):
            repaired = repaired.strip("`")
            repaired = repaired[repaired.find("{"):repaired.rfind("}") + 1]
        return json.loads(repaired)
    except Exception as e:
        raise RuntimeError(f"LLM extraction failed: {e}")


def merge_llm_result_into_invoice(inv: OcrInvoice, llm_dict: dict, force_fields=None) -> OcrInvoice:
    """Fill only the fields that are still None on `inv`, using llm_dict."""
    force_fields = force_fields or []

    def fill(obj, data: dict, prefix=""):
        if not data:
            return
        for key, val in data.items():
            if key == "iva_breakdown":
                continue  # handled separately below
            full_key = f"{prefix}{key}"
            if hasattr(obj, key) and (getattr(obj, key) in (None, [], "") or full_key in force_fields):
                if isinstance(val, str):
                    val = clean_extracted_text(val)
                setattr(obj, key, val)

    fill(inv.general_info, llm_dict.get("general_info", {}), "general_info.")
    fill(inv.supplier, llm_dict.get("supplier", {}), "supplier.")
    fill(inv.totals, llm_dict.get("totals", {}), "totals.")
    fill(inv.status, llm_dict.get("status", {}), "status.")

    # Merge iva_breakdown rows
    raw_breakdown = llm_dict.get("totals", {}).get("iva_breakdown", [])
    if raw_breakdown and not inv.totals.iva_breakdown:
        inv.totals.iva_breakdown = [
            IVABreakdownRow(**{k: v for k, v in row.items() if k in IVABreakdownRow.__dataclass_fields__})
            for row in raw_breakdown if isinstance(row, dict)
        ]

    if not inv.line_items and llm_dict.get("line_items"):
        cleaned_items = []
        for li in llm_dict["line_items"]:
            if not isinstance(li, dict):
                continue
            item_data = {k: v for k, v in li.items() if k in LineItem.__dataclass_fields__}
            for k, v in item_data.items():
                if isinstance(v, str):
                    item_data[k] = clean_extracted_text(v)
            cleaned_items.append(LineItem(**item_data))
        inv.line_items = cleaned_items

    inv.meta.extraction_method = (
        "hybrid" if inv.meta.extraction_method == "regex" else "llm"
    )
    return inv


def format_ocr_markdown_with_llm(raw_text: str) -> str:
    """Uses the LLM to clean up garbled OCR output into clean Markdown.
    
    Ported from OCR_invoice with the full prompt including:
    - Column alignment arithmetic verification
    - Quantity column disambiguation (UDS vs Cajas)
    - B2C inclusive tax labeling rule
    - IVA breakdown table formatting
    - Supplier vs Customer disambiguation
    """
    dynamic_dict = _build_bilingual_dictionary()
    prompt = (
        "You are an expert at reconstructing raw document text into clean, structured Markdown.\n"
        "The following text is extracted from an invoice or delivery note. "
        "Your task is to:\n"
        "1. Identify the ACTUAL PRODUCTS/SERVICES and reconstruct them into a proper Markdown table. The table MUST retain ALL columns present in the original text (for example, if you see columns like 'GRA.', 'U/M', 'und', 'Unit', 'DTO.', include them in the table!). Ensure you also map columns for: Code, Description, Quantity, Gross Price (before discount), Net Price (after discount), IVA %, Amount/Total.\n"
        "CRITICAL ARITHMETIC ALIGNMENT RULE: The Quantity multiplied by the Net Price (or Unit Price) should equal the Amount/Total. Use this to verify you have mapped the columns correctly!\n"
        "LINE ITEM QUANTITY RULE: If a table has multiple quantity-like columns (e.g. 'Cajas' vs 'UDS'/'CANTIDAD'), prefer the 'UDS' or 'CANTIDAD' column for the actual quantity. Extract Gross Price as the exact printed price per that unit. DO NOT back-calculate the price.\n"
        "STRICT NO-INVENTION RULE: You MUST ONLY extract numbers that literally appear in the raw text! DO NOT perform calculations to generate/invent new numbers!\n"
        "LINE ITEM SEPARATION RULE: Do NOT merge multiple distinct products into a single row's description. Keep each line item separate.\n"
        "B2C INCLUSIVE TAX RULE: If the line items on the receipt INCLUDE tax (i.e., their sum equals the Grand Total rather than the Subtotal), you MUST explicitly label the Amount column as 'Amount (Inc. IVA)'.\n"
        "Do NOT hallucinate rows. Do NOT extract company logos or footers as line items if they have no valid quantity/price.\n"
        "IMPORTANT: Do NOT extract 'Adjustments', 'Credits', 'Regulatory Operating Costs', 'DST Fees' or other additional fees as line items in the table!\n"
        "2. Identify the IVA/TAX BREAKDOWN section (which lists the tax rates, base amounts, and tax amounts). YOU MUST format this breakdown as a Markdown table (e.g. Rate, Base, IVA, Total). This is CRITICAL for data extraction downstream.\n"
        "3. Keep all the other information intact and well-structured using Markdown headings and lists. Be sure to explicitly extract the Supplier name, Supplier VAT ID/CIF, Customer name, Customer VAT ID/CIF, Document Number, Date, Subtotal (of products only), ALL Taxes (e.g. IVA amounts), all Adjustments/Fees, and the Grand Total.\n"
        "=== DATE PARSING ===\n"
        "Spanish dates are DD/MM/YY. The LAST number is the year, the FIRST is the day. "
        "E.g., if you see '19/05/26', it means day 19, month 05, year 2026. DO NOT write '26/05/2019'.\n"
        "=== SUPPLIER vs CUSTOMER ===\n"
        "You must semantically deduce the Supplier vs the Customer. Do NOT rely solely on who appears at the top of the page.\n"
        "The SUPPLIER is the vendor providing the goods or services. Their name is often printed prominently (like a logo).\n"
        "The CUSTOMER is the client receiving and paying for the goods/services, often indicated by 'CLIENTE:' or 'NOMBRE:'.\n"
        "--- SUPPLIER KEYWORDS (English/Spanish): Supplier, Proveedor, Vendor, Vendedor, Seller, Sold By, Issuer, Emisor, Company, Empresa, From, De, Billed By, Facturado por.\n"
        "--- CUSTOMER KEYWORDS (English/Spanish): Customer, Cliente, Client, Buyer, Comprador, Bill To, Facturar a, Invoice To, Sold To, Vendido a, Ship To, Enviar a, Recipient, Destinatario, Purchaser.\n"
        "--- VAT/TAX ID TERMS: VAT, VAT ID, Tax ID, TIN, IVA, NIF, CIF, NIE, NIF/CIF, CIF/NIF, NIF-IVA, Número de IVA, C.I.F., N.I.F.\n"
        "CRITICAL: The Supplier's NIF/CIF MUST be the seller's tax ID. If the document contains MULTIPLE tax IDs, carefully associate each ID with its respective company. Never extract the Customer's tax ID into the Supplier section.\n"
        "IMPORTANT HINT: The Supplier's NIF/CIF is sometimes printed in tiny text at the edge of the document alongside their registry details (e.g., 'Registre Mercantil... C.I.F. A-08064313'). If found there, it belongs to the Supplier.\n"
        "IMPORTANT HINT: A CIF/NIF located near any CUSTOMER KEYWORDS (like 'CLIENTE' or 'NOMBRE') is the CUSTOMER'S tax ID. DO NOT mix them up.\n"
        "STRICT MISSING DATA RULE: If the Supplier's VAT ID is completely missing from the extracted text, you MUST leave it blank. NEVER guess, and NEVER use the Customer's VAT ID as a substitute!\n"
        "4. Output ONLY the reconstructed Markdown text. Do not add any conversational text or ```markdown fences.\n\n"
        "Here is the raw text:\n\n"
        f"{raw_text}\n"
        f"{dynamic_dict}"
    )

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=_model(),
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=8000,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```markdown"):
            content = content[11:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()
    except Exception as e:
        logger.error(f"Failed to format OCR markdown with LLM: {e}")
        return raw_text
