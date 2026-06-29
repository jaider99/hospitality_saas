"""
llm_fallback.py
================
Stage 2: gpt-oss-120b extraction.
"""

from __future__ import annotations
import json
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

from openai import OpenAI
from app.ocr.schema import Invoice, LABELS, LINE_ITEM_HEADERS

BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
API_KEY = os.environ.get("LLM_API_KEY", "")
MODEL_NAME = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")

_client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


def _build_bilingual_dictionary() -> str:
    lines = ["\n=== BILINGUAL FIELD MAPPINGS ==="]
    lines.append("To help you map Spanish terms to the correct JSON field, use this dictionary:")
    for key, words in LABELS.items():
        lines.append(f"- {key}: {', '.join(words)}")
    lines.append("For Line Items:")
    for key, words in LINE_ITEM_HEADERS.items():
        lines.append(f"- items[].{key}: {', '.join(words)}")
    return "\n".join(lines)


SCHEMA_DESCRIPTION = """
Return ONLY valid JSON (no markdown fences, no commentary) matching this
exact structure. **CRITICAL: To save tokens, completely OMIT any field that is null or empty.**
Do not invent values. Numbers must be plain numbers (no currency symbols, use '.'
as the decimal separator regardless of source format):

{
  "serialNumber": string|null,
  "type": string|null, // "Invoice", "Delivery Note", or "Receipt"
  "category": string|null, // Guess the expense category (e.g. "Marketing", "Food & Beverage", "Utilities")
  "date": "YYYY-MM-DD"|null, // Ensure 4 digit year, no typos like 202b
  "subtotal": number,
  "tax": number,
  "total": number,
  "discount": number,
  "payeAmount": number,
  "greenPointAmount": number,
  "ibeeAmount": number,
  "taxableAdditionalCost": number,
  "netAdditionalCost": number,
  "isReconciled": boolean,
  "paidStatus": string|null,
  "documentInboxEmail": string|null,
  "supplier": {
    "name": string|null,
    "legalName": string|null,
    "vatID": string|null,
    "address": string|null,
    "contacts": number|null,
    "contactInfo": string|null
  },
  "items": [
    {
      "providerCode": string|null,
      "product": string|null,
      "quantity": number|null,
      "unit": string|null,
      "grossPrice": number|null,
      "discountPct": number|null,
      "appliedDiscount": number|null,
      "otherFees": number|null,
      "nominalPrice": number|null,
      "iva_pct": number|null,
      "base": number|null
    }
  ],
  "taxBrackets": [
    {"taxRate": 4, "subtotal": 3.56, "tax": 0.14, "total": 3.70},
    {"taxRate": 10, "subtotal": 31.40, "tax": 3.14, "total": 34.54}
  ],
  "payment": {
    "dueDate": "YYYY-MM-DD"|null,
    "method": string|null
  }
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
    "--- SUPPLIER KEYWORDS (English/Spanish): Supplier, Proveedor, Vendor, Vendedor, Seller, Sold By, Vendido por, Issuer, Emisor, Emisor de la factura, Company, Empresa, Merchant, Comerciante, From, De, Billed By, Facturado por, Service Provider, Prestador del servicio, Exporter, Exportador, Manufacturer, Fabricante, Distributor, Distribuidor, Retailer, Minorista.\n"
    "--- CUSTOMER KEYWORDS (English/Spanish): Customer, Cliente, Client, Buyer, Comprador, Bill To, Facturar a, Invoice To, Sold To, Vendido a, Ship To, Enviar a, Delivery Address, Dirección de envío, Recipient, Destinatario, Purchaser, Billed To, Facturado a, Account Holder, Titular, End Customer, Cliente final.\n"
    "--- VAT/TAX ID TERMS: VAT, VAT ID, VAT No., Tax ID, TIN, GSTIN, EIN, IVA, NIF, CIF, NIE, NIF/CIF, CIF/NIF, NIF-IVA, Número de IVA, IVA Intracomunitario, Identificación Fiscal, C.I.F., N.I.F., etc.\n"
    "CRITICAL: The 'supplier.vatID' MUST be the NIF/CIF of the Vendor. If the document contains MULTIPLE tax IDs, carefully associate each ID with its respective company. Never extract the Customer's tax ID into the Supplier section.\n"
    "IMPORTANT HINT: The Supplier's NIF/CIF is sometimes printed in tiny text at the edge/margins of the document alongside their registry details (e.g., 'Registre Mercantil de Barcelona... C.I.F. - A 08064313'). If found there, it belongs to the Supplier.\n"
    "IMPORTANT HINT: If a CIF/NIF is listed directly beneath or next to any CUSTOMER KEYWORDS (e.g. labeled 'D.N.I./C.I.F: B67019018' near 'CLIENTE:'), that is the CUSTOMER's tax ID, NOT the Supplier's. DO NOT put the Customer's ID in `supplier.vatID`.\n"
    "\nTAX ID DISAMBIGUATION: An invoice has TWO tax IDs — the SUPPLIER's "
    "(seller, usually in the letterhead/header near the company logo and "
    "registry info, e.g. 'C.I.F. A12345678') and the CUSTOMER's (buyer, "
    "usually labeled 'D.N.I./C.I.F.' near 'NOMBRE:'/'CLIENTE:'/'DIRECCIÓN:' "
    "fields). NEVER assign the customer's tax ID to supplier.vatID. If you "
    "can only find one tax ID and it's clearly next to customer/buyer "
    "fields (NOMBRE, DIRECCIÓN, CIUDAD), leave supplier.vatID as null "
    "rather than guessing it's the supplier's.\n"
    "STRICT MISSING DATA RULE: If the Supplier's VAT ID is completely missing from the extracted text (e.g., the OCR failed to read it), you MUST output `null` for `supplier.vatID`. NEVER guess, and NEVER use the Customer's VAT ID as a substitute!\n"
    "ABSOLUTE PROHIBITION: You must NEVER put the Customer's VAT ID into the `supplier.vatID` field. If `supplier.vatID` is identical to the Customer's VAT ID, you have failed the task.\n"
    "=== GENERAL INFO ===\n"
    "DATE PARSING: Spanish/Catalan dates are DD/MM/YY or DD/MM/YYYY. "
    "The LAST number is always the year, the FIRST is always the day. "
    "E.g. '19/05/26' = day=19, month=05, year=2026. NEVER interpret "
    "the first 2-digit number as a year. Always output as ISO YYYY-MM-DD. "
    "Prefix 2-digit years with '20' (e.g., 26 -> 2026).\n"
    "DOCUMENT TYPE: Always use the EXACT label printed in the page header: "
    "'Albarán' (delivery note), 'Factura' (invoice), 'Recibo' (receipt), etc. "
    "Do NOT default to 'Invoice'. If the header says 'ALBARÁN COPIA', the "
    "type is 'Albarán', not 'Invoice'.\n"
    "The 'serialNumber' is the unique ID of the invoice or receipt. "
    "It typically looks like: 'A26-004800', 'F2026-001', '2485/26', 'ALB-0012345', 'FBADS-233-105870698', 'LA/C187763'. "
    "NOT a hex hash like '676d82', NOT a barcode, NOT a date, NOT 'pendiente/comprobant'. "
    "Look for labels: Document, Documento, Nº, No., Nº Factura, Nº Albarán, Invoice No. "
    "IMPORTANT: A 'Document' or 'Invoice' number is strictly preferred over a generic 'Reference' or 'Order' number. If both exist, ALWAYS pick the Document/Invoice number. If only an 'Order Number' or 'Pedido' is present, you MUST extract it as the `serialNumber`.\n"
    "If in doubt, prefer alphanumeric codes with a year component (e.g. 2026) or uppercase letters like 'LA/'.\n"
    "\n"
    "=== TOTALS & TAX BREAKDOWN ===\n"
    "Source text is markdown — tables are preserved as | col | col | rows. "
    "If you see a multi-rate TAX table like:\n"
    "  | IVA 4% | 3.56 | 0.14 | 3.70 |\n"
    "  | IVA 10% | 31.40 | 3.14 | 34.54 |\n"
    "Extract EACH RATE as a separate object in `taxBrackets` with fields: "
    "{taxRate, subtotal, tax, total}. "
    "DO NOT mix values from different rows! "
    "The `subtotal` for IVA 4% is 3.56, NOT 31.40. Read column by column, row by row.\n"
    "GRAND TOTAL RULE: The `total` field must be the final Grand Total of the entire invoice (e.g. Total Factura, Total a Pagar). NEVER map a single line item's total to the invoice `total` field. If the Grand Total is 8.67, output 8.67.\n"
    "The overall `subtotal` MUST be the printed 'Subtotal' or 'BASE IMPONIBLE' (Total before tax, before adjustments and fees).\n"
    "For 'total': extract it ONLY from an explicit printed total field (e.g. "
    "'IMPORTE ALBARÁN', 'TOTAL A PAGAR', 'Total (EUR)', 'TOTAL FACTURA'). "
    "Do NOT calculate total = subtotal + tax yourself. Do NOT subtract "
    "any discounts from the total — the printed grand total already "
    "accounts for them.\n"
    "Do NOT use a subtotal as the total if there is a larger grand total.\n"
    "Do NOT use a quantity (1,00) or page number (1/1) as the total.\n"
    "\n"
    "=== LINE ITEMS ===\n"
    "Each line item logically contains: [Code] [Description] [Qty] [Unit] [Price] [Base].\n"
    "ONLY extract actual products/services as line items. DO NOT extract additional fees, regulatory costs, credits, or adjustments as line items.\n"
    "Due to OCR limitations, these fields are often heavily INTERLEAVED across multiple lines.\n"
    "When a table has multiple quantity-like columns (e.g. 'Cajas', 'Bultos', "
    "'UDS', 'Unidades', 'Cantidad' in the same row), ALWAYS prefer the column "
    "whose header most directly means total units sold: prefer 'UDS'/'Unidades'/"
    "'Cantidad' over package-count columns like 'Cajas'/'Bultos'. Extract "
    "grossPrice as the price per that same unit, exactly as printed — do NOT "
    "multiply/divide it to fit a total. NEVER back-calculate quantity or price "
    "to make a total match. If uncertain, set quantity=null and rely on 'base'.\n"
    "You MUST reconstruct the row by associating the Code, Product Name, and the closest numeric values for Qty, Unit (if available like 'und', 'U/M', 'kg', 'l'), and Price. Extract the unit into the `unit` field.\n"
    "CRITICAL: Be extremely careful not to confuse numbers INSIDE a product description (e.g., 'PICOS DE METAL X 12 UDS', 'PUREE 1 KG') with the actual quantity or price columns. The actual quantity and price will be separate numeric blocks. You MUST strictly preserve the vertical order of the line items to avoid swapping values between rows!\n"
    "CRITICAL: You MUST extract the Unit Price into `nominalPrice` and the Total Amount (Qty * Price) into `base` for EVERY line item. Never omit them if they exist on the page.\n"
    "Always ensure EVERY extracted product gets its `base` and `iva_pct`.\n"
    "If the receipt is a B2C receipt (like Apple Retail or Meta Ads) where line items are listed WITH tax, extract the listed price into `grossPrice` BUT you MUST mathematically strip the IVA to calculate the pre-tax `base` amount for each line item (e.g. base = grossPrice / (1 + iva_pct/100)) so that the sum of line item bases equals the invoice's overall `subtotal`. If the invoice has no tax (iva_pct = 0 or missing), then `base` MUST EXACTLY EQUAL `grossPrice`.\n"
    "Never put TAX-breakdown rows or general total rows as line items.\n"
    "CRITICAL FOR DIGITAL AD INVOICES: If you see digital advertising campaigns (e.g. Meta Ads, Facebook, Google Ads), the main row contains the campaign name (e.g., 'Campaña de Interacción Farola') and its price. Directly beneath it there is often a descriptive row detailing the metrics (e.g., 'Nuevo conjunto de anuncios de Interacción - 238 Impresiones') with the EXACT SAME PRICE printed again. DO NOT extract the 'Impresiones' row as a separate line item! This will double-count the total. You must SKIP the 'Impresiones' row and only extract the main campaign row.\n"
    "\n"
    "=== ADDITIONAL FEES & ADJUSTMENTS ===\n"
    "DISCOUNTS: A %Dto or discount percentage in the line-items table applies "
    "ONLY to that specific row. Never copy a line-item's discount percentage "
    "to the document-level 'discount' field. The top-level 'discount' field "
    "is only for an explicit document-wide discount amount shown in the totals "
    "section (e.g. 'Descuento general: 10.00 €').\n"
    "If the markdown contains 'Regulatory Operating Costs', 'DST Fees', 'Pago aplazado', 'Canon', or other fees that increase the grand total but are NOT already included in the line items or the IVA breakdown, YOU MUST sum them up and place the sum in `taxableAdditionalCost`.\n"
    "CRITICAL: If a fee (like Canon) is already included in the invoice's Subtotal or if adding it to the Subtotal+Tax exceeds the Grand Total, DO NOT put it in `taxableAdditionalCost`! Otherwise it will double-count.\n"
    "If the markdown contains credits or adjustments that decrease the total, place the sum as a POSITIVE number in `discount`.\n"
    "CRITICAL: The `payeAmount` field is for Income Tax Withholding (IRPF / Retenciones). DO NOT put 'Payments' or 'Pagado' amounts in `payeAmount`!\n"
    "\n"
    "=== FEW-SHOT EXAMPLES OF OCR NOISE ===\n"
    "OCR can be garbled. Use these examples of garbled text to understand the intent:\n"
    "If you see: 'Remolacha Fresca Amarilla / Mix' → Code: 'BverRemMIXkg', Product: 'Remolacha Fresca Amarilla / Mix Colores kg', Qty: 1.4, Gross: 2.54, IVA: 4, Base: 3.56.\n"
    "If you see: 'Puré Boiron Melón Cantalup' → Code: 'BpurMelonk1', Qty: 2, Gross: 12.7, IVA: 10, Base: 25.4.\n"
    "If you see: 'Hojas de Naranja tarr' → Code: 'HojDeNarTarr', Qty: 2, Gross: 3, IVA: 10, Base: 6.\n"
    "If you see: 'PICOS DE METAL X 12 UDS' → Code: 'PIA-05321012', Qty: 1, Base: 0.0, IVA: 21.\n"
    "If you see: 'ALBARICOQUE RAVIFRUIT' → Code: 'RAV-08010', Qty: 1, Base: 3.31, IVA: 21.\n"
    "If you see: 'PUREE 1 KG.' → Code: 'TEG-N8012', Qty: 1, Base: 21.55, IVA: 21.\n"
    "If you see: 'PELADOR INOX ANCHO' → Qty: 12, Base: 99.60, IVA: 10.\n"
    "If you see: 'CUCHILLO PUNTILLA MONDADOR' → Code: 'BOH-188600', Qty: 1, Base: 4.40, IVA: 21.\n"
    "If you see spaced out letters like 'F a c t u r a' or 'M a k r o', remove the spaces when extracting (e.g. 'Factura', 'Makro').\n"
    "\n"
    "=== SUPPLIER VS CUSTOMER ===\n"
    "The VAT ID is usually labeled as: NIF, CIF, NIF-IVA, VAT, VAT Number, Número de IVA, or IVA intracomunitario.\n"
    "CRITICAL: If the document contains MULTIPLE VAT IDs (e.g. one for the Supplier and one for the Customer), you MUST extract the one belonging to the SUPPLIER/VENDOR into `supplier.vatID`.\n"
    "Remember: A VAT ID near any CUSTOMER KEYWORDS (e.g., 'CLIENTE', 'Facturar a', 'Bill To') is the Customer's. A VAT ID near SUPPLIER KEYWORDS or in the 'Registre Mercantil' header/footer/logo is the Supplier's.\n"
    "HOWEVER, if the document only contains ONE VAT ID on the entire page, extract that exact VAT ID into `supplier.vatID`, even if it is located near the Customer's address.\n"
    "\n"
    "=== ARITHMETIC RULES ===\n"
    "DO NOT compute sums for `subtotal` or `tax`. The pipeline does all arithmetic in Python. "
    "Your job is to find and return the raw values printed on the document. "
    "If a field is genuinely absent, completely OMIT it from the JSON to save output tokens.\n"
    "CRITICAL: DO NOT use <think> blocks. DO NOT provide any reasoning. Output ONLY the raw JSON immediately."
)


def extract_with_llm(raw_text: str, missing_fields: Optional[list] = None) -> dict:
    """Calls LLM and returns a parsed dict matching the schema."""
    user_prompt = (
        f"{SCHEMA_DESCRIPTION}\n\n"
        f"Invoice Text:\n"
        f'"""\n{raw_text}\n"""\n\n'
        f"Extract ALL the invoice fields into the JSON schema provided."
    )
    if missing_fields:
        user_prompt += f"\n\nCRITICAL: The following fields are currently missing. Pay EXTRA attention to finding them in the text: {', '.join(missing_fields)}"

    dynamic_system_prompt = SYSTEM_PROMPT + "\n" + _build_bilingual_dictionary()

    response = _client.chat.completions.create(
        model=MODEL_NAME,
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
        repair_resp = _client.chat.completions.create(
            model=MODEL_NAME,
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

def merge_llm_result_into_invoice(inv: Invoice, llm_dict: dict, force_fields=None) -> Invoice:
    force_fields = force_fields or []
    
    # Flat fields
    flat_fields = [
        "serialNumber", "type", "date", "subtotal", "tax", "total", "discount",
        "payeAmount", "greenPointAmount", "ibeeAmount", "taxableAdditionalCost",
        "netAdditionalCost", "isReconciled", "paidStatus", "documentInboxEmail"
    ]
    adj_fields = {"discount", "payeAmount", "greenPointAmount", "ibeeAmount", "taxableAdditionalCost", "netAdditionalCost"}
    
    for k in flat_fields:
        # Always trust LLM for financial totals over regex, as regex often grabs incorrect stray numbers.
        is_financial_total = k in ("subtotal", "tax", "total")
        if getattr(inv, k) in (None, "", 0.0, False) or k in force_fields or k in adj_fields or is_financial_total:
            if k in llm_dict and llm_dict[k] is not None:
                setattr(inv, k, llm_dict[k])

    def fill(obj, data: dict):
        if not data:
            return
        for key, val in data.items():
            if hasattr(obj, key) and getattr(obj, key) in (None, "", 0, False):
                setattr(obj, key, val)

    fill(inv.supplier, llm_dict.get("supplier", {}))
    fill(inv.payment, llm_dict.get("payment", {}))

    raw_breakdown = llm_dict.get("taxBrackets", [])
    if raw_breakdown and not inv.taxBrackets:
        from app.ocr.schema import TaxBracket
        inv.taxBrackets = [
            TaxBracket(**{k: v for k, v in row.items() if k in TaxBracket.__dataclass_fields__})
            for row in raw_breakdown if isinstance(row, dict)
        ]

    if not inv.items and llm_dict.get("items"):
        from app.ocr.schema import LineItem
        inv.items = [LineItem(**{k: v for k, v in li.items() if k in LineItem.__dataclass_fields__})
                          for li in llm_dict["items"]]

    return inv


def format_ocr_markdown_with_llm(raw_text: str) -> str:
    prompt = (
        "You are an expert at reconstructing raw document text into clean, structured Markdown.\n"
        "The following text is extracted from an invoice or delivery note. "
        "Your task is to:\n"
        "1. Identify the ACTUAL PRODUCTS/SERVICES and reconstruct them into a proper Markdown table. The table MUST retain ALL columns present in the original text (for example, if you see columns like 'GRA.', 'U/M', 'und', 'Unit', 'DTO.', include them in the table!). Ensure you also map columns for: Code, Description, Quantity, Gross Price (before discount), Net Price (after discount), Discount % (extremely important!), IVA %, Amount/Total.\n"
        "DISCOUNT PERCENTAGE: You MUST extract the discount percentage (DTO / % / Discount) for each line item if it exists. DO NOT output 0 or null if there is a discount applied! If Gross Price and Net Price differ, there is a discount, and you must find it in the text or calculate the percentage.\n"
        "CRITICAL ARITHMETIC ALIGNMENT RULE: The Quantity multiplied by the Net Price (or Unit Price) should equal the Amount/Total. Use this to verify you have mapped the columns correctly! For example, if you see '0.495 10%' and 'AC.DESHUESADAS 7.950 3.94', Qty=0.495, Price=7.950, Total=3.94 (because 0.495 * 7.950 = 3.93525). If your chosen Qty * Price does not match the Total printed on the page, YOU HAVE MAPPED THE COLUMNS WRONG and must try a different mapping.\n"
        "LINE ITEM QUANTITY RULE: If a table has multiple quantity-like columns (e.g. 'Cajas' vs 'UDS'/'CANTIDAD'), prefer the 'UDS' or 'CANTIDAD' column for the actual quantity, not the 'Cajas' column. Extract Gross Price as the exact printed price per that unit. DO NOT back-calculate the price.\n"
        "QUANTITY EXTRACTION: If a product description appears to end with a standalone number (e.g. 'MORITZ 7 1/3 24BOT RET 28'), that trailing number is almost always the QUANTITY column value that wrapped onto the same line as the description — extract it into 'quantity', not as part of the product name. Cross-check: quantity × gross_price - applied_discount should equal base (within 0.05). If it does not match with quantity=1, look for a wrapped/misplaced quantity digit in the description text and re-extract it.\n"
        "STRICT NO-INVENTION RULE: You MUST ONLY extract numbers that literally appear in the raw text! DO NOT perform calculations to generate/invent new numbers! If you invent a number like '31.32' that isn't in the text, you fail.\n"
        "LINE ITEM SEPARATION RULE: Do NOT merge multiple distinct products into a single row's description. Keep each line item separate on its own row just as they appear in the source.\n"
        "B2C INCLUSIVE TAX RULE: If the line items on the receipt INCLUDE tax (i.e., their sum equals the Grand Total rather than the Subtotal), you MUST explicitly label the Amount column as 'Amount (Inc. IVA)'. Do NOT hallucinate '0%' for the IVA % of fees like 'Canon' if it is not explicitly printed as 0%; either leave it blank or use the general rate.\n"
        "Do NOT hallucinate rows. Do NOT extract company logos or footers (like 'CONSERVAS ORTIZ') as line items if they have no valid quantity/price.\n"
        "IMPORTANT: Do NOT extract 'Adjustments', 'Credits', 'Regulatory Operating Costs', 'DST Fees' or other additional fees as line items in the table! Leave them as raw text or standard lists outside the table.\n"
        "PACKAGING/DEPOSITS EXCLUSION: If you see a section titled 'VALORACION ECONOMICA DE ENVASES' or similar containing lines like 'BOTELLA 1/3 LN RET' or 'PLASTICO VACIO' with negative/return quantities (e.g. '-21 CJ'), YOU MUST NOT extract them as products! Completely ignore these packaging deposit/return lines from the main Line Items table.\n"
        "2. Identify the IVA/TAX BREAKDOWN section (which lists the tax rates, base amounts, and tax amounts). YOU MUST format this breakdown as a Markdown table (e.g. Rate, Base, IVA, Total). This is CRITICAL for data extraction downstream.\n"
        "3. Keep all the other information intact and well-structured using Markdown headings and lists. Be sure to explicitly extract the Supplier name, Supplier VAT ID/CIF, Customer name, Document Number, Date, Subtotal (of products only), ALL Taxes (e.g. IVA amounts), all Adjustments/Fees, and the Grand Total.\n"
        "TOTAL: when multiple total-like labels exist (e.g. 'PROD+ENVASES' vs 'TOTAL ENTREGA'), the FINAL total after all discounts/fees/taxes is the correct value for 'total' — usually the LAST and LARGEST-context labeled total on the page, often called 'TOTAL ENTREGA', 'TOTAL A PAGAR', 'IMPORTE TOTAL'. A subtotal labeled 'PROD+ENVASES' or similar is a pre-discount intermediate figure, NOT the final total.\n"
        "ABSOLUTE PROHIBITION: You must NEVER extract the Customer's VAT ID. If you see a VAT ID next to the Customer's name (e.g. 'D.N.I./C.I.F: B67019018' near 'CLIENTE:'), you MUST replace it with '[REDACTED]' in the Markdown output. Do NOT include the Customer's real VAT ID anywhere in the Markdown output!\n"
        "=== DATE PARSING ===\n"
        "Spanish dates are DD/MM/YY. The LAST number is the year, the FIRST is the day. "
        "E.g., if you see '19/05/26', it means day 19, month 05, year 2026. DO NOT write '26/05/2019'.\n"
        "=== SUPPLIER vs CUSTOMER ===\n"
        "You must semantically deduce the Supplier vs the Customer. Do NOT rely solely on who appears at the top of the page.\n"
        "The SUPPLIER is the vendor providing the goods or services. Their name is often printed prominently (like a logo).\n"
        "The CUSTOMER is the client receiving and paying for the goods/services, often indicated by 'CLIENTE:' or 'NOMBRE:'.\n"
        "--- SUPPLIER KEYWORDS (English/Spanish): Supplier, Proveedor, Vendor, Vendedor, Seller, Sold By, Vendido por, Issuer, Emisor, Company, Empresa, Merchant, Comerciante, From, De, Billed By, Facturado por.\n"
        "--- CUSTOMER KEYWORDS (English/Spanish): Customer, Cliente, Client, Buyer, Comprador, Bill To, Facturar a, Invoice To, Sold To, Vendido a, Ship To, Enviar a, Recipient, Destinatario, Purchaser.\n"
        "--- VAT/TAX ID TERMS: VAT, VAT ID, Tax ID, TIN, IVA, NIF, CIF, NIE, NIF/CIF, CIF/NIF, NIF-IVA, Número de IVA, C.I.F., N.I.F.\n"
        "CRITICAL: The Supplier's NIF/CIF MUST be the seller's tax ID. If the document contains MULTIPLE tax IDs, carefully associate each ID with its respective company. Never extract the Customer's tax ID into the Supplier section.\n"
        "IMPORTANT HINT: The Supplier's NIF/CIF is sometimes printed in tiny text at the edge of the document alongside their registry details (e.g., 'Registre Mercantil... C.I.F. A-08064313'). If found there, it belongs to the Supplier.\n"
        "IMPORTANT HINT: A CIF/NIF located near any CUSTOMER KEYWORDS (like 'CLIENTE' or 'NOMBRE') is the CUSTOMER'S tax ID. DO NOT mix them up.\n"
        "STRICT MISSING DATA RULE: If the Supplier's VAT ID is completely missing from the extracted text (e.g., the OCR failed to read it), you MUST leave it blank. NEVER guess, and NEVER use the Customer's VAT ID as a substitute!\n"
        "\n"
        "=== TWO-COLUMN LAYOUT RULE ===\n"
        "The raw text may contain a separator '--- DOCUMENT INFO COLUMN ---'. If present:\n"
        "  - Text BEFORE this separator = LEFT COLUMN (contains: Supplier logo/header AND the Customer delivery address block).\n"
        "  - Text AFTER this separator = RIGHT COLUMN (contains: document number, date, transport number — NOT supplier or customer identity).\n"
        "Do NOT confuse right-column numbers/codes with supplier or customer names.\n"
        "\n"
        "=== DISTRIBUTOR RECEIPT RULE ===\n"
        "Some Spanish delivery notes are from food/beverage distributors (e.g. Moritz, Estrella, Heineken). They print TWO company names in the header:\n"
        "  1. THE SUPPLIER: The distributor's legal company (e.g. 'DISTRIBUCIONES E.POZO S.L.') with 'C.I.F. B-XXXXXXX' attached directly on the same line or immediately after. This entity IS the Supplier.\n"
        "  2. THE CUSTOMER BLOCK: A block with a client account code (e.g. 'FAROLA · 397118'), street address, city, company name (e.g. 'REC 67 PARTNERS SL'), and a standalone 'NIF: BXXXXXXX' label line. This ENTIRE block belongs to the CUSTOMER.\n"
        "KEY RULE: A 'NIF:' or 'D.N.I.:' label on its own standalone line always belongs to the CUSTOMER. The Supplier's CIF always appears directly after 'C.I.F.' on the same line as their legal company name (e.g. 'S.L. · C.I.F. B-6003877').\n"
        "Do NOT extract the Customer's delivery account code as the document serial number.\n"
        "\n"
        "4. Output ONLY the reconstructed Markdown text. Do not add any conversational text or ```markdown fences.\n\n"
        "Here is the raw text:\n\n"
        f"{raw_text}\n"
        f"{_build_bilingual_dictionary()}"
    )

    try:
        response = _client.chat.completions.create(
            model=MODEL_NAME,
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
