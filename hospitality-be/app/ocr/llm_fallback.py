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
from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

from openai import OpenAI
from app.ocr.schema import Invoice, LABELS, LINE_ITEM_HEADERS

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "").strip()
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", 16384))
MODEL_NAME = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")
LLM_FALLBACK_MODEL = os.environ.get("LLM_FALLBACK_MODEL", "inclusionai/ring-2.6-1t")

_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY, timeout=150.0)


def _call_llm_with_fallback(messages: list, temperature: float = 0, model_name: str = MODEL_NAME, use_fallback_model: bool = False) -> any:
    if use_fallback_model:
        # User explicitly requested the fallback model
        logger.warning(f"Starting Secondary Text Model extraction using: {LLM_FALLBACK_MODEL}...")
        try:
            response = _client.chat.completions.create(
                model=LLM_FALLBACK_MODEL,
                temperature=temperature,
                messages=messages,
                max_tokens=LLM_MAX_TOKENS,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if not content or not content.strip():
                raise ValueError("Secondary LLM returned empty content.")
            logger.warning(f"Secondary Text Model ({LLM_FALLBACK_MODEL}) extraction completed successfully.")
            return response
        except Exception as e:
            logger.error(f"Secondary Text Model ({LLM_FALLBACK_MODEL}) failed: {e}")
            raise e

    try:
        response = _client.chat.completions.create(
            model=model_name,
            temperature=temperature,
            messages=messages,
            max_tokens=LLM_MAX_TOKENS,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content or not content.strip():
            raise ValueError("Primary LLM returned empty content.")
        logger.warning(f"Primary Text Model ({model_name}) extraction completed successfully.")
        return response
    except Exception as e:
        logger.warning(f"Primary Text Model ({model_name}) failed: {e}. Falling back to {LLM_FALLBACK_MODEL}...")
        try:
            logger.warning(f"Starting Fallback Text Model extraction using: {LLM_FALLBACK_MODEL}...")
            fallback_response = _client.chat.completions.create(
                model=LLM_FALLBACK_MODEL,
                temperature=temperature,
                messages=messages,
                max_tokens=LLM_MAX_TOKENS,
                response_format={"type": "json_object"},
            )
            fallback_content = fallback_response.choices[0].message.content
            if not fallback_content or not fallback_content.strip():
                raise ValueError("Fallback LLM returned empty content.")
            logger.warning(f"Fallback Text Model ({LLM_FALLBACK_MODEL}) extraction completed successfully.")
            return fallback_response
        except Exception as fallback_e:
            logger.error(f"Fallback Text Model ({LLM_FALLBACK_MODEL}) also failed: {fallback_e}")
            raise fallback_e



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
      "base": number|null,
      "gra": number|null,
      "u_m": number|null
    }
  ],
  "taxBrackets": [
    {"taxRate": 21, "subtotal": 0.0, "tax": 0.0, "total": 0.0}
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
    "=== META / FACEBOOK INVOICES ===\n"
    "Meta/Facebook ad invoices often print the Campaign name on one line, and the Ad Set sub-name on the next line WITH THE EXACT SAME PRICE REPEATED. (e.g. 'Campaña... €16.60' followed immediately by 'Nuevo conjunto... €16.60').\n"
    "DO NOT extract these as two separate items! The second line is just a sub-description. Only extract one line item for that €16.60 charge. The sum of the line items MUST equal the invoice subtotal.\n"
    "=== TAX BRACKETS (VAT BREAKDOWN) ===\n"
    "You MUST extract the VAT/Tax breakdown from the bottom of the invoice into the `taxBrackets` array.\n"
    "  • 'Base' or 'B.Imponible' or 'Base Imponible' -> `subtotal`\n"
    "  • '%IVA' or 'Tipo IVA' or 'IVA %' -> `taxRate` (e.g. 21, 10, 4). Ignore prefixes like '121.00' (extract 21) or '210.00' (extract 10).\n"
    "  • 'Imp.IVA' or 'Cuota IVA' or 'Importe IVA' -> `tax`\n"
    "  • 'TOTAL' -> `total`\n"
    "If the invoice lists multiple tax rates (e.g. 10% and 21%), extract each one as a separate object in the array.\n"
    "NEVER guess or hallucinate these values. Read them exactly as printed.\n"
    "=== SUPPLIER vs CUSTOMER & RETAIL RECEIPTS ===\n"
    "You MUST identify the Supplier (seller) and the Customer (buyer) before doing anything else.\n"
    "For receipts from large retail brands (Apple, MediaMarkt, El Corte Inglés, Samsung, etc.):\n"
    "  • The STORE BRAND (e.g. 'Apple', 'Apple Passeig de Gràcia') is the SUPPLIER. Their legal entity + CIF (e.g. 'Apple Retail Spain, S.L.U., CIF ESB65130643') appear in the receipt footer/header. Extract as Supplier Name and Supplier VAT ID/CIF.\n"
    "  • The CUSTOMER is the person/company who BOUGHT: their name and NIF appear under 'CLIENTE:', 'Client', 'Nombre:', 'Facturar a:', or 'NIF:' (e.g. 'REC 67 PARTNERS SL', NIF B67019018). Show as Customer Name. NEVER extract the customer's VAT ID as the supplier's VAT ID. The supplier's NIF is usually printed in small text in the header/footer (e.g. 'NIF B...').\n"
    "  • CREDIT CARD MERCHANT IDs: If you see numbers labeled 'COMERCIO', 'FUC', or 'Merchant ID' (e.g., '01851214754'), NEVER extract these as the Supplier VAT ID or the Document Number! These are internal credit card terminal IDs, not valid CIF/NIFs.\n"
    "  • 'Canon por copia privada' is a Spanish regulatory levy (Royal Decree) attached to electronic devices. It appears as a separate line item with a small price. Extract it as a real line item (not as taxableAdditionalCost) because it is already included in the printed Grand Total.\n"

    "  • The 'Artículo:' field on each line is the Apple part number — use it as `providerCode`.\n"
    "DO NOT redact the Supplier Name, Supplier VAT ID, or Customer Name — they MUST appear explicitly in the output.\n"
    "PROVIDER CODES: Provider/Product codes are typically alphanumeric strings or integers (e.g. '08064313', '1344'). NEVER extract a decimal number with a period or comma (e.g., '1.750') as a provider code. If you see a decimal, it is likely a price or quantity.\n"
    "NEVER GROUP OR COMBINE LINE ITEMS: Even if two items appear logically related (e.g., similar or identical product names, sequential parts, or a product and its associated fee/tax), you MUST extract them as completely separate line items exactly as printed. Combining multiple rows into a single summarized product is STRICTLY FORBIDDEN. Each distinct printed row must correspond to exactly one extracted line item.\n"
    "PRODUCT NAME CORRECTION: If the OCR text for a product description contains obvious spelling errors or garbled characters (e.g. 'Canon por oa rivada' instead of 'obra privada', or missing letters), you MUST gently correct the spelling to make it readable in the Markdown output.\n"
    "MISSING PRODUCT NAMES: If the OCR text is jumbled and a line item appears to have no product description, look at the surrounding lines. Product names are typically alphabetical strings (e.g., 'Product A', 'Fresh Milk 1L'). If a text string is floating on a nearby line, you MUST aggressively assign it as the `product` description for the nearest line item. NEVER leave the `product` field as null if there are unused alphabetical text strings nearby.\n"
    "CREDIT CARD RECEIPTS: If a credit card terminal receipt is stapled to the invoice, you will see text like 'MASTERCARD', 'VISA', 'TARJETA', 'TVR', or 'COMERCIO'. **NEVER extract 'MASTERCARD' or 'VISA' as the Supplier Name.** The actual supplier name is the store/company name printed on the main invoice (e.g. 'Artyplan').\n"
    "SUPPLIER NAME EXTRACTION: The supplier name is usually the largest text at the top, or explicitly labeled. DO NOT use abbreviations or truncate the name. Extract the FULL legal name.\n"
    "INVOICE SUBTOTAL VALIDATION: The sum of the 'Amount' column for all Line Items MUST strictly equal the Invoice Subtotal (within a few cents). If your extracted line items sum to 4155.30 but the Subtotal is 1658.00, YOU HAVE FAILED. You MUST re-read the OCR text and find the correct quantities and prices such that their sum matches the Subtotal.\n"
    "=== CLUMPED PRICING AND DISCOUNTS (GENERAL HEURISTIC) ===\n"
    "On many distribution invoices, OCR will clump multiple pricing columns together into a single string (e.g., '[UnitPrice] [Discount] [Base] [TaxRate]').\n"
    "If you see a clump of numbers at the end of a line item, use mathematical logic to map them to the correct fields:\n"
    "  • The true Unit Price (`grossPrice`) is the exact printed price before any discounts. NEVER back-calculate a unit price if a printed one exists.\n"
    "  • If the sum of the next two numbers equals (Quantity * Unit Price), those two numbers are the Discount Amount (`appliedDiscount`) and the final Base Amount (`base`)!\n"
    "  • You MUST extract the printed Unit Price into `grossPrice`, the Discount Amount into `appliedDiscount`, and the final Base Amount into `base`.\n"
    "  • Do NOT hallucinate or divide numbers if the exact mathematical components (Unit Price, Discount, Base) are printed on the page.\n"
    "=== COMPLEX TAX TABLES & ECO-TAXES ===\n"
    "If an invoice has complex tax footers with interleaved columns (e.g., '%IVA Base PVerd IBEE B.Imponible Imp.IVA TOTAL'):\n"
    "  • Be aware that OCR often prefixes tax rates with typos (e.g., '121.00' for 21%, '210.00' for 10%). Interpret them logically.\n"
    "  • Identify the pure 'Base' column for the tax brackets. Do NOT confuse the raw tax 'Base' with 'B.Imponible' (which often includes eco-taxes like IBEE or Punto Verde).\n"
    "  • The sum of your extracted line item `base` values MUST equal the sum of the pure tax `Base` column.\n"
    "=== SIDEWAYS SCANNED INVOICES & MISALIGNED ROWS (CRITICAL) ===\n"
    "Sometimes OCR reads down columns instead of across rows, or pushes prices to the lines BELOW the products.\n"
    "For example, you might see:\n"
    "  Product A\n"
    "  Product B\n"
    "  1   1,50\n"
    "  1   1,60\n"
    "CRITICAL SEQUENTIAL MAPPING RULE: If you see N products listed sequentially, followed by N detached prices or quantities, you MUST map them strictly 1-to-1 in sequential order! (The 1st product gets the 1st price, the 2nd gets the 2nd, etc). Do NOT skip products. If the invoice says '9 ARTIC.', there MUST be exactly 9 line items extracted.\n"
    "COLUMNAR OCR RECONSTRUCTION (CRITICAL): If the OCR text lists an entire column of product names (e.g. under 'Concepto') and then later lists an entire column of quantities (e.g. 'Uds.') and prices (e.g. 'Base Ud.' or 'Precio'), you MUST reconstruct the rows by matching the Nth product with the Nth quantity and the Nth price! Do not invent or duplicate prices. Match the columns mathematically and sequentially.\n"
    "If the document contains a '--- DOCUMENT INFO COLUMN ---' separator, reconstruct the rows by matching the Nth product in the left section with the Nth price/total in the right section.\n"
    "ORPHANED AMOUNTS & ZIG-ZAGS (CRITICAL): If you see an entire row of numbers (Quantity, Price, Base) on a line by itself, and a product name on the line ABOVE or BELOW it, you MUST pair them together! Do not leave quantities or prices as null if there are orphaned numbers nearby that mathematically match. If the OCR mixes the price of one row with the product name of the row ABOVE or BELOW it, you MUST use strict math (`Quantity * Price = Base`) to find the expected Base and assign it to the correct product! Never leave the base as 0.0 if you can mathematically find it nearby.\n"
    "APPLE & RETAIL RECEIPTS (PRICES BEFORE PRODUCTS): For some retail receipts (especially Apple), the OCR may read the price BEFORE the product name (e.g. you see a floating price on one line, and the product name on the next line). You MUST match the floating price to the product description immediately following it!\n"
    "LAST PRODUCT & GRAND TOTAL OVERLAP (CRITICAL): Sometimes the last product name gets pushed onto the exact same line as the GRAND TOTAL. If you see a product name and a very large amount at the end of the line, DO NOT blindly assign that amount as the product's price! Look at the line ABOVE it to see if the real quantity/price were left orphaned. The product MUST be paired with its actual orphaned price, and the large amount must be extracted as the `total`.\n"
    "TAX-INCLUSIVE PRICES: If the sum of the printed line item prices equals the GRAND TOTAL (e.g., 25.75) instead of the SUBTOTAL, then those prices INCLUDE tax. You MUST back-calculate the pre-tax `base` (e.g., base = 1.50 / 1.21) and extract the pre-tax unit price as `grossPrice`.\n"
    "ANTI-HALLUCINATION RULE: If prices are disconnected or jumbled, you MUST find the actual printed prices in the text. DO NOT guess, invent, divide, or average out prices to make the math work (e.g., hallucinating a unit price by dividing the total base by the quantity). If OCR smashed numbers together without spaces (e.g. '16,2424.35'), you MAY split them logically at the decimal point ('16.24' and '24.35'), but do not invent new digits. Extract the exact printed digits and match them logically to the Nth product.\n"
    "DECIMAL QUANTITIES & TRAILING TAX CODES: Some invoices list items in the format `[Code] [Description] [Unit] [Price/Ud] [Quantity] [Base] ...`. Pay extremely close attention to decimal quantities like `2,240` (meaning 2.24) and their corresponding unit prices (e.g. `15,830`). Do NOT mistake a trailing integer (like `1` or `5` indicating a tax or department code) at the very end of the line for the quantity. Always verify your extraction by checking that `Quantity * Price = Base`!\n"
    "=== GENERAL INFO ===\n"
    "DATE PARSING: Spanish/Catalan dates are DD/MM/YY or DD/MM/YYYY. "
    "The LAST number is always the year, the FIRST is always the day. "
    "E.g. '19/05/26' = day=19, month=05, year=2026. NEVER interpret "
    "the first 2-digit number as a year. Always output as ISO YYYY-MM-DD. "
    "Prefix 2-digit years with '20' (e.g., 26 -> 2026).\n"
    "DOCUMENT TYPE: You must classify the document into exactly one of: 'Invoice', 'Delivery Note', or 'Receipt'.\n"
    "  • If the header says 'ALBARÁN', 'Albaran', or 'Nota de entrega', you MUST set the type to 'Delivery Note'.\n"
    "  • If it says 'FACTURA' or 'Invoice', set it to 'Invoice'.\n"
    "  • If it says 'RECIBO', 'Ticket', or 'Comprobante', set it to 'Receipt'.\n"
    "  • CRITICAL: Delivery Notes (Albaranes) very often DO NOT have any prices printed on them (only quantities). This is perfectly normal. If there are no prices on the document, DO NOT invent them. Leave `grossPrice`, `base`, `subtotal`, `tax`, and `total` as null or 0.0.\n"
    "The 'serialNumber' is the unique ID of the invoice or receipt. "
    "It typically looks like: 'A26-004800', 'F2026-001', '2485/26', 'ALB-0012345', '5122', 'FBADS-233-105870698', 'LA/C187763'. "
    "NOT a hex hash like '676d82', NOT a barcode, NOT a date, NOT 'pendiente/comprobant', NOT a phone number, NOT a credit card transaction or Application ID (like 'A00000...', 'Aut: 487810'). "
    "CRITICAL: In Spanish invoices the label 'FACTURA:', 'NÚMERO' or 'NUMERO' directly introduces the document number. "
    "E.g. if you see 'FACTURA: 5122', then '5122' is the serialNumber. "
    "Similarly 'Nº Albarán: 12345' → '12345' and 'NUMERO ALV25173716' → 'ALV25173716'. "
    "If the OCR text is jumbled (e.g. rotated), the number might appear on a different line than the label. For example, if you see '4303950' and later 'FACTURA:', the document number is '4303950'. "
    "Phone numbers (e.g. 'T.916011440' or '93 319 52 06' or '933195206-93' or any 9-digit numbers starting with 9, 8, 7, 6) are NEVER the document number! "
    "Look for labels: NUMERO, NÚMERO, FACTURA:, Nº FACTURA, Nº ALBARÁN, Albara, Albarà, Document, Documento, Nº, No., Nº Factura, Nº Albarán, Invoice No. "
    "IMPORTANT: A 'Document' or 'Invoice' number is strictly preferred over a generic 'Reference' or 'Order' number. If both exist, ALWAYS pick the Document/Invoice number. If only an 'Order Number' or 'Pedido' is present, you MUST extract it as the `serialNumber`.\n"
    "PREFIX STRIPPING & GARBAGE REMOVAL: You MUST extract ONLY the alphanumeric document ID (e.g., '12101542', 'INV/123456'). DO NOT extract the label itself, and DO NOT extract any surrounding garbage text, table headers, employee names (e.g., 'John Doe'), or newlines. If the OCR smashed the label and the number together (e.g. 'No.A1baran12101542', 'Fra.1234'), you MUST strip off the label prefix.\n"
    "If in doubt, prefer alphanumeric codes with a year component (e.g. 2026) or uppercase letters with slashes like 'DOC/123'.\n"
    "\n"
    "=== TOTALS & TAX BREAKDOWN ===\n"
    "Source text is markdown — tables are preserved as | col | col | rows. "
    "If you see a multi-rate TAX table like:\n"
    "  | IVA 4% | [Subtotal A] | [Tax A] | [Total A] |\n"
    "  | IVA 10% | [Subtotal B] | [Tax B] | [Total B] |\n"
    "Extract EACH RATE as a separate object in `taxBrackets` with fields: "
    "{taxRate, subtotal, tax, total}. "
    "If the `total` for a specific tax bracket is NOT explicitly printed in the table, you MUST calculate it as `subtotal + tax`.\n"
    "DO NOT mix values from different rows! Read column by column, row by row.\n"
    "GRAND TOTAL RULE: The `total` field must be the final Grand Total of the entire invoice (e.g. Total Factura, Total a Pagar). NEVER map a single line item's total to the invoice `total` field. If the Grand Total is 8.67, output 8.67.\n"
    "The overall `subtotal` MUST be the printed 'Subtotal' or 'BASE IMPONIBLE' (Total before tax, before adjustments and fees).\n"
    "For 'total': extract it ONLY from an explicit printed total field (e.g. "
    "'IMPORTE ALBARÁN', 'TOTAL A PAGAR', 'Total (EUR)', 'TOTAL FACTURA', 'TOTAL ENTREGA', 'IMPORTE TOTAL'). "
    "Do NOT calculate total = subtotal + tax yourself. Do NOT subtract "
    "any discounts from the total — the printed grand total already "
    "accounts for them.\n"
    "CRITICAL TAX RULE: If there is no explicit Tax/IVA amount printed on the document, you MUST set the `tax` field to `0.0`. NEVER duplicate the `total` or `subtotal` into the `tax` field!\n"
    "Do NOT use a subtotal as the total if there is a larger grand total.\n"
    "Do NOT use a quantity (1,00) or page number (1/1) as the total.\n"
    "\n"
    "=== LINE ITEMS ===\n"
    "Each line item logically contains: [Code/ART] [Description] [Gra (graduación/degree)] [U/M (unit/liter size)] [Qty/BOT/UDS] [Price/PRECIO] [Base/Amount].\n"
    "UTILITY BILL RULE (ELECTRICITY/GAS): If the document is a utility bill with multiple pages, you are STRICTLY FORBIDDEN from extracting high-level summary rows that combine multiple underlying charges into broad categories (e.g., summaries like 'Total Energy Used' / 'Por energía utilizada', 'Contracted Power' / 'Por potencia contratada', or grouped 'Taxes and Fees' / 'Impuestos y bonos'). You MUST instead find and extract the detailed interleaved breakdown from the itemized pages (e.g., specific meter readings, individual power periods like 'P1'/'P2', and specific individual taxes/fees like 'Bono social' or 'Impuesto Eléctrico'). You must extract these detailed rows even if they are heavily garbled or interleaved with customer addresses. This is a hard requirement.\n"
    "To ensure you comply with this rule, if the invoice is a utility bill, you MUST start your response with a `<think>...</think>` block. Inside the think block, explicitly identify which text represents the 'Summary Block' and which text represents the 'Garbled Detailed Block', and then state that you will only extract the detailed block. Then output the JSON.\n"
    "ONLY extract actual products, services, fees, regulatory costs, or adjustments as line items IF they are printed as distinct rows with their own prices. If a fee or tax is printed as a distinct row in the items table, you MUST extract it as its own separate line item.\n"
    "Due to OCR limitations, these fields are often heavily INTERLEAVED across multiple lines.\n"
    "You MUST reconstruct the row by associating:\n"
    "- providerCode (ART.): the alphanumeric product code (e.g. 001783, 006115)\n"
    "- product: the product description (e.g. BAILEYS 0.70, CINZANO ROSSO BOTTEGA 1757)\n"
    "- gra: the alcohol percentage/degree (from GRA. column, e.g. 17.0, 16.0, 40.0). Save as a plain number. If there is no GRA column, leave it null.\n"
    "- u_m: the capacity volume size in liters/kg (from U/M column, e.g. 0.700, 1.000). Save as a plain number.\n"
    "- quantity: the number of units sold (prefer BOT. or UDS or Cantidad column over package-count columns like Cajas/Bultos).\n"
    "- grossPrice: the unit price before discount (from PRECIO column).\n"
    "- nominalPrice: the unit price after discount.\n"
    "- base: the total line amount before tax (usually Quantity * nominalPrice).\n"
    "When a table has multiple quantity-like columns (e.g. 'Cajas', 'Bultos', 'BOT.', 'UDS', 'Cantidad' in the same row), ALWAYS prefer the column whose header most directly means total units sold: prefer 'BOT.'/'UDS'/'Cantidad' over package-count columns like 'Cajas'/'Bultos'. Extract grossPrice as the exact printed price per that unit, exactly as printed.\n"
    "CRITICAL: Be extremely careful not to confuse numbers INSIDE a product description (e.g., 'PICOS DE METAL X 12 UDS', 'PUREE 1 KG') with the actual quantity or price columns. The actual quantity and price will be separate numeric blocks. You MUST strictly preserve the vertical order of the line items to avoid swapping values between rows!\n"
    "CRITICAL FAILSAFE: NEVER return an empty array `[]` for `items` if there are clearly products listed on the invoice. If the OCR text is extremely jumbled, or if the prices are garbled/missing, you MUST STILL extract the product names (e.g. 'ANBAR', 'MORITZ'), codes, and quantities, and simply leave the price fields as `null`. Returning an empty `items` array when products are visible is a CRITICAL FAILURE. An imperfectly mapped product list is always better than an empty list.\n"
    "GRA VS PRICE MISMATCH: Look carefully at the Spanish table headers (e.g. 'GRA.', 'PRECIO'). If the invoice does NOT have a 'GRA.' (alcohol degree) column, do NOT extract prices or other numbers into the `gra` field; leave it null. If both are present, map them strictly according to their columns.\n"
    "CRITICAL: You MUST extract the Unit Price into `grossPrice` (or `nominalPrice` if discounted) and the Total Amount (Qty * Price) into `base` for EVERY line item. Never omit them if they exist on the page.\n"
    "Always ensure EVERY extracted product gets its `base` and `iva_pct`.\n"
    "If the receipt is a B2C receipt (like Apple Retail, DOMOS SHOP, or Meta Ads) where line items are listed WITH tax, you MUST back-calculate the PRE-TAX Unit Price and extract that into `grossPrice`. e.g. Pre-tax Unit Price = Printed Price / (1 + iva_pct/100). Do NOT extract the tax-inclusive price as `grossPrice`. Also back-calculate the pre-tax `base` amount for each line item (Base = Pre-tax Unit Price * Qty) so that the sum of line item bases equals the invoice's overall `subtotal`. If the invoice has no tax (iva_pct = 0 or missing), then `base` MUST EXACTLY EQUAL `grossPrice` * qty.\n"
    "Never put VAT/IVA breakdown tables or general total rows as line items. However, if a specific tax or fee (e.g., 'Impuesto Eléctrico') is printed as a distinct row in the main products table, you MUST extract it as a line item.\n"
    "CRITICAL FOR DIGITAL AD INVOICES: If you see digital advertising campaigns (e.g. Meta Ads, Facebook, Google Ads), the main row contains the campaign name (e.g., 'Campaña de Interacción Farola') and its price. Directly beneath it there is often a descriptive row detailing the metrics (e.g., 'Nuevo conjunto de anuncios de Interacción - 238 Impresiones') with the EXACT SAME PRICE printed again. DO NOT extract the 'Impresiones' row as a separate line item! This will double-count the total. You must SKIP the 'Impresiones' row and only extract the main campaign row.\n"
    "\n"
    "=== ADDITIONAL FEES & ADJUSTMENTS ===\n"
    "DISCOUNTS: A %Dto or discount percentage in the line-items table applies "
    "ONLY to that specific row. Never copy a line-item's discount percentage "
    "to the document-level 'discount' field. The top-level 'discount' field "
    "is only for an explicit document-wide discount amount shown in the totals "
    "section (e.g. 'Descuento general: 10.00 €').\n"
    "CRITICAL: NEVER put the invoice Total or Subtotal into the `discount` field! If there is no explicit discount, leave it null.\n"
    "TAX BRACKETS: Only populate `taxBrackets` if there is an explicit table breaking down the VAT by percentage (e.g. 10%, 21%). Do NOT invent base amounts or tax amounts if they are not explicitly printed on the document! If there is no breakdown table, leave `taxBrackets` empty.\n"
    "If the markdown contains 'Regulatory Operating Costs', 'DST Fees', 'Pago aplazado', 'Canon', or other fees that increase the grand total but are NOT already included in the line items or the IVA breakdown, YOU MUST sum them up and place the sum in `taxableAdditionalCost`.\n"
    "CRITICAL: If a fee (like Canon) is already included in the invoice's Subtotal or if adding it to the Subtotal+Tax exceeds the Grand Total, DO NOT put it in `taxableAdditionalCost`! Otherwise it will double-count.\n"
    "If the markdown contains credits or adjustments that decrease the total, place the sum as a POSITIVE number in `discount`.\n"
    "CRITICAL: The `payeAmount` field is for Income Tax Withholding (IRPF / Retenciones). DO NOT put 'Payments' or 'Pagado' amounts in `payeAmount`!\n"
    "\n"
    "=== FEW-SHOT EXAMPLES OF OCR NOISE ===\n"
    "OCR can be garbled. Use these examples of garbled text to understand the intent:\n"
    "If you see a utility bill summary like: 'Por energía utilizada 15.17' but later see a garbled detailed block interleaved with an address like 'NIF: Potencia [P1] 8.60 ... B22792121 Potencia [P2] 8.39 ... Dirección: Energía 15.17 ... CARDERS 31 Bono social 0.58 ... BARCELONA Impuesto Eléctrico 1.67 ... Alquiler de contador 0.80', you MUST completely ignore the 'Por energía utilizada' summary block and extract the 6 distinct details from the garbled block: Item 1: 'Potencia [P1]' Base 8.60. Item 2: 'Potencia [P2]' Base 8.39. Item 3: 'Energía' Base 15.17. Item 4: 'Bono social' Base 0.58. Item 5: 'Impuesto Eléctrico' Base 1.67. Item 6: 'Alquiler de contador' Base 0.80.\n"
    "If you see: 'Remolacha Fresca Amarilla / Mix' → Code: 'BverRemMIXkg', Product: 'Remolacha Fresca Amarilla / Mix Colores kg', Qty: 1.4, Gross: 2.54, IVA: 4, Base: 3.56.\n"
    "If you see: 'Puré Boiron Melón Cantalup' → Code: 'BpurMelonk1', Qty: 2, Gross: 12.7, IVA: 10, Base: 25.4.\n"
    "If you see: 'Hojas de Naranja tarr' → Code: 'HojDeNarTarr', Qty: 2, Gross: 3, IVA: 10, Base: 6.\n"
    "If you see heavily jumbled rows like:\n"
    "  10.00\n"
    "  2.000 5.000\n"
    "  3.000 12.00\n"
    "  2148 PRODUCT ALPHA 4.000 10%\n"
    "  5122 PRODUCT BETA\n"
    "You must mathematically pair the stranded numbers with the stranded descriptions! 2.000 * 5.000 = 10.00 (PRODUCT ALPHA). 4.000 * 3.000 = 12.00 (PRODUCT BETA). Extract BOTH items as separate rows.\n"
    "=== SIDEWAYS INVOICE: MULTI-ITEM COUNTING RULE ===\n"
    "For sideways/rotated scans the OCR may jumble product rows together. Before finalising the items array, count how many DISTINCT product descriptions you can identify in the raw text. "
    "Your items array MUST contain exactly that many entries — one per product. "
    "You MAY use a <think>...</think> block before outputting JSON to plan your extraction, particularly to count the items and reconstruct sideways tables. "
    "After your thinking block, output ONLY the raw JSON string. Do NOT output ```json ... ``` tags. Your entire response MUST be valid JSON and nothing else.\n"
    "Cross-check: sum of all item `base` values must be within ±0.15 € of the printed subtotal. "
    "If they do not match, re-read the text to find the missing rows.\n"
    "If you see: 'PICOS DE METAL X 12 UDS' → Code: 'PIA-05321012', Qty: 1, Base: 0.0, IVA: 21.\n"
    "If you see: 'ALBARICOQUE RAVIFRUIT' → Code: 'RAV-08010', Qty: 1, Base: 3.31, IVA: 21.\n"
    "If you see: 'PUREE 1 KG.' → Code: 'TEG-N8012', Qty: 1, Base: 21.55, IVA: 21.\n"
    "If you see: 'PELADOR INOX ANCHO' → Qty: 12, Base: 99.60, IVA: 10.\n"
    "If you see: 'CUCHILLO PUNTILLA MONDADOR' → Code: 'BOH-188600', Qty: 1, Base: 4.40, IVA: 21.\n"
    "If you see: 'F a c t u r a' or 'M a k r o', remove the spaces when extracting (e.g. 'Factura', 'Makro').\n"
    "MERGED NUMBERS RULE: OCR sometimes glues numbers together without spaces (e.g. '362,0921.076,04' or '173,4921,00'). You MUST intelligently split them apart based on expected columns. For example, '362,09' (Base), '21.0' (IVA rate), and '76,04' (Tax amount). Use common sense to split them at the correct decimal boundaries.\n"
    "=== MESSY IVA / TOTALS SECTIONS ===\n"
    "If you see jumbled totals at the bottom (e.g., '173,4921,00', '36,43', '209,92') or in the Marginal Text (e.g., 'otal€ 209,92'), you MUST split the merged strings and populate the `taxBrackets` and the overall invoice `subtotal`, `tax`, and `total`. For example, '173,4921,00' means Base=173.49, Rate=21.00. The standalone '36,43' is the IVA amount. Do NOT leave them empty.\n"
    "If you see a jumbled tax breakdown like '1.00 11.00', '10.00 10', '21.00', '20.00 5 1.00', you must match the Base, Tax%, and TaxAmount! Here, Base 10.00 @ 10% = Tax 1.00 (Total 11.00), and Base 20.00 @ 5% = Tax 1.00 (Total 21.00). Subtotal = 10.00 + 20.00 = 30.00. Tax = 1.00 + 1.00 = 2.00. Total = 32.00.\n"
    "\n"
    "=== MARGINAL TEXT RECOVERY RULE ===\n"
    "The text may contain a section '--- Marginal Text ---' or '--- Marginal Text (Full Resolution) ---'. "
    "This section contains additional OCR text from the edges/margins of the document that was captured separately.\n"
    "CRITICAL: When a line item has a product CODE and PRICE/QTY but is MISSING a product description in the main body, "
    "you MUST scan the Marginal Text section and recover the description from there.\n"
    "How to match: The Marginal Text typically lists product codes or abbreviated names in the same order as the line items. "
    "Match by code number (e.g. code '08064313' → look for '08064313' or 'RIERA' or 'RIERA FI' in Marginal Text) "
    "or by position (1st item in main text → 1st product name in Marginal Text).\n"
    "Example: Main text has '08064313 1.000 10% 3.95' (no description). "
    "Marginal text has 'RIERA FI' → product name = 'RIERA FUET' (expand known abbreviations).\n"
    "If the description in marginal text is abbreviated (e.g. 'RIERA FI', 'MARCHAP', 'LATORRE'), expand it using context "
    "from the full text or use the abbreviation as-is if you cannot expand it confidently.\n"
    "NEVER leave product name as null/empty if the code or any abbreviated name exists in Marginal Text!\n"
    "=== SUPPLIER VS CUSTOMER ===\n"
    "The VAT ID is usually labeled as: NIF, CIF, NIF-IVA, VAT, VAT Number, Número de IVA, or IVA intracomunitario.\n"
    "CRITICAL: If the document contains MULTIPLE VAT IDs (e.g. one for the Supplier and one for the Customer), you MUST extract the one belonging to the SUPPLIER/VENDOR into `supplier.vatID`.\n"
    "Remember: A VAT ID near any CUSTOMER KEYWORDS (e.g., 'CLIENTE', 'Facturar a', 'Bill To') is the Customer's. A VAT ID near SUPPLIER KEYWORDS or in the header/logo is the Supplier's. The customer's information (name and VAT) should NOT be extracted as the supplier.\n"
    "SIDE-BY-SIDE RULE: If the OCR lists two companies side-by-side (e.g., 'VINIQUS SL' on the left and 'FAROLA' on the right), and one is clearly the restaurant/buyer (e.g. 'FAROLA REC 67'), the OTHER company (e.g. 'VINIQUS SL') is the Supplier! Do not leave the supplier empty just because the OCR misplaced the word 'Cliente' above it. The entity issuing the invoice is ALWAYS the supplier.\n"
    "\n"
    "=== CORRUPTED DATES ===\n"
    "Dates in OCR are frequently corrupted (e.g., '12/00/2025' instead of '12/05/2025', or '15-04-202' instead of '15-04-2024'). If a date appears invalid or truncated in the main text, look at the Marginal text or POS receipt text (e.g., 'Fecha...') to cross-reference and reconstruct the correct YYYY-MM-DD date. Use logical deduction to fix OCR typos in days, months or years.\n"
    "\n"
    "=== TRAILING DASHES & NEGATIVE NUMBERS ===\n"
    "CRITICAL: Many suppliers use a trailing dash purely as a printing convention to prevent manual alteration (e.g., '58.08-', '48.00-') or as a unit suffix (e.g., '8-C' for 8 Cajas). "
    "DO NOT parse trailing dashes as negative numbers! Treat '58.08-' as a POSITIVE 58.08 and '8-C' as a POSITIVE 8.\n"
    "ONLY output negative numbers if the document explicitly states it is an 'ABONO' (Credit Note) or 'FACTURA RECTIFICATIVA' (Refund), or if it uses standard negative formatting (e.g., '-58.08'). "
    "If it is a standard 'ALBARAN' (Delivery Note) or 'FACTURA' (Invoice), amounts and quantities with trailing dashes MUST be positive.\n"
    "\n"
    "=== ARITHMETIC RULES ===\n"
    "DO NOT compute sums for `subtotal` or `tax`. The pipeline does all arithmetic in Python. "
    "Your job is to find and return the raw values printed on the document. "
    "If a field is genuinely absent, completely OMIT it from the JSON to save output tokens.\n"
    "VAT-INCLUSIVE RULE: If the receipt only shows VAT-inclusive (Gross) prices (e.g. 1,20) and does NOT show a separate Base/Net price, DO NOT mathematically calculate the Base price by subtracting VAT (e.g. do not calculate 0.99). Extract the printed amount (1.20) into BOTH `grossPrice` and `base`.\n"
    "CRITICAL: You may provide your reasoning inside a <think> block, but immediately after it, you MUST output ONLY the raw JSON."
)


def extract_with_llm(raw_text: str, missing_fields: Optional[list] = None, use_fallback_model: bool = False) -> dict:
    """Calls LLM and returns a parsed dict matching the schema."""
    if use_fallback_model:
        logger.warning(f"Starting Secondary Text Model extraction using: {LLM_FALLBACK_MODEL}...")
    else:
        logger.warning(f"Starting Primary Text Model extraction using: {MODEL_NAME}...")
    user_prompt = (
        f"{SCHEMA_DESCRIPTION}\n\n"
        f"Invoice Text:\n"
        f'"""\n{raw_text}\n"""\n\n'
        f"Extract ALL the invoice fields into the JSON schema provided."
    )
    if missing_fields:
        user_prompt += f"\n\nCRITICAL: The following fields are currently missing. Pay EXTRA attention to finding them in the text: {', '.join(missing_fields)}"

    dynamic_system_prompt = SYSTEM_PROMPT + "\n" + _build_bilingual_dictionary()

    response = _call_llm_with_fallback(
        temperature=0,
        messages=[
            {"role": "system", "content": dynamic_system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        use_fallback_model=use_fallback_model
    )
    
    message = response.choices[0].message
    if not message or not message.content:
        logger.error(f"LLM returned an empty response. Raw response: {response}")
        raise ValueError("LLM returned an empty response")
    
    content = message.content.strip()
    
    # Strip <think> blocks (often produced by reasoning models)
    import re
    content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
    
    if content.startswith("```"):
        content = content.strip("`")
        content = content[content.find("{"):content.rfind("}") + 1]
        
    try:
        data = json.loads(content)
        
        # Utility Bill Failsafe Validation
        if data.get("category") == "Utilities" or any("potencia" in str(i.get("product", "")).lower() for i in data.get("items", [])):
            bad_summaries = ["por energía utilizada", "por potencia contratada", "energía utilizada", "potencia contratada"]
            has_bad_summary = any(any(bad in str(i.get("product", "")).lower() for bad in bad_summaries) for i in data.get("items", []))
            
            if has_bad_summary:
                logger.warning("LLM extracted summary rows instead of detailed utility rows. Forcing retry...")
                raise ValueError("Extracted high-level summary rows instead of interleaved detailed block")
                
        return data
    except Exception as e:
        logger.warning(f"LLM validation failed: {e}. Attempting repair.")
        repair_prompt = (
            f"Your previous output failed validation: {str(e)}\n\n"
            f"If the error says 'Extracted high-level summary rows', you MUST look at the raw OCR text again, ignore the clean summary block (like 'Por energía utilizada 15.17' and 'Por potencia contratada 16.99'), and extract the highly garbled interleaved block containing 6 distinct lines (e.g., 'Potencia [P1] 8.60', 'Potencia [P2]', 'Energía 15.17', 'Bono social', 'Impuesto Eléctrico', 'Alquiler de contador') exactly as instructed in the UTILITY BILL RULE. Extract ALL 6 DISTINCT ITEMS.\n\n"
            f"If the error is a JSON format error, fix the JSON.\n\n"
            f"Please correct the output and return ONLY valid JSON matching the schema."
        )
        repair_resp = _call_llm_with_fallback(
            temperature=0,
            messages=[
                {"role": "system", "content": dynamic_system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": content},
                {"role": "user", "content": repair_prompt},
            ],
            use_fallback_model=use_fallback_model
        )
        repaired = repair_resp.choices[0].message.content.strip()
        repaired = re.sub(r'<think>.*?</think>', '', repaired, flags=re.DOTALL).strip()
        if repaired.startswith("```"):
            repaired = repaired.strip("`")
            repaired = repaired[repaired.find("{"):repaired.rfind("}") + 1]
        return json.loads(repaired)

def merge_llm_result_into_invoice(inv: Invoice, llm_dict: dict, force_fields=None) -> Invoice:
    force_fields = force_fields or []
    
    # Flat fields
    flat_fields = [
        "serialNumber", "type", "date", "subtotal", "tax", "total", "discount",
        "payeAmount", "greenPointAmount", "ibeeAmount", "taxableAdditionalCost",
        "netAdditionalCost", "isReconciled", "paidStatus", "documentInboxEmail", "categoryID"
    ]
    adj_fields = {"discount", "payeAmount", "greenPointAmount", "ibeeAmount", "taxableAdditionalCost", "netAdditionalCost"}
    
    if "category" in llm_dict and llm_dict["category"]:
        llm_dict["categoryID"] = llm_dict["category"]

    for k in flat_fields:
        # Always trust LLM for financial totals, serial numbers, and dates over regex.
        is_financial_total = k in ("subtotal", "tax", "total", "serialNumber", "date")
        if getattr(inv, k) in (None, "", 0.0, False) or k in force_fields or k in adj_fields or is_financial_total:
            if k in llm_dict and llm_dict[k] is not None:
                setattr(inv, k, llm_dict[k])

    def fill(obj, data: dict):
        if not data:
            return
        for key, val in data.items():
            if hasattr(obj, key) and getattr(obj, key) in (None, "", 0, False):
                setattr(obj, key, val)

    if "supplier" in llm_dict:
        supp_data = llm_dict["supplier"]
        if "name" in supp_data and supp_data["name"]:
            inv.supplier.name = supp_data["name"]
        if "vatID" in supp_data and supp_data["vatID"]:
            inv.supplier.vatID = supp_data["vatID"]
        # Fill other fields only if empty
        for key, val in supp_data.items():
            if key not in ("name", "vatID") and hasattr(inv.supplier, key) and getattr(inv.supplier, key) in (None, "", 0, False):
                # Stringify any dict values to prevent Postgres VARCHAR type errors
                if isinstance(val, dict):
                    val = ", ".join(f"{k}: {v}" for k, v in val.items())
                elif not isinstance(val, (str, int, float, bool, type(None))):
                    val = str(val)
                setattr(inv.supplier, key, val)

    fill(inv.payment, llm_dict.get("payment", {}))

    raw_breakdown = llm_dict.get("taxBrackets", [])
    if raw_breakdown:
        from app.ocr.schema import TaxBracket
        inv.taxBrackets = [
            TaxBracket(**{k: v for k, v in row.items() if k in TaxBracket.__dataclass_fields__})
            for row in raw_breakdown if isinstance(row, dict)
        ]

    if llm_dict.get("items"):
        from app.ocr.schema import LineItem
        inv.items = [LineItem(**{k: v for k, v in li.items() if k in LineItem.__dataclass_fields__})
                          for li in llm_dict["items"]]

    return inv


def format_ocr_markdown_with_llm(raw_text: str) -> str:
    system_prompt = (
        "You are an expert at reconstructing raw document text into clean, structured Markdown.\n"
        "The following text is extracted from an invoice or delivery note. "
        "Your task is to:\n"
        "1. Identify the ACTUAL PRODUCTS/SERVICES and reconstruct them into a proper Markdown table. The table MUST retain ALL columns present in the original text. For wine/spirits invoices, you MUST include columns like 'GRA.' (alcohol percentage/degree, e.g. 17.0, 16.0, 40.0) and 'U/M' (unit of measure / volume size in liters, e.g. 0.700, 1.000). Reconstruct columns for: Code, Description, Graduación (GRA.), Unit Liters (U/M), Quantity, Gross Price (PRECIO before discount), Net Price, Discount %, IVA %, Amount/Total.\n"
        "DISCOUNT PERCENTAGE: You MUST extract the discount percentage (DTO / % / Discount) for each line item if it exists. DO NOT output 0 or null if there is a discount applied! If Gross Price and Net Price differ, there is a discount, and you must find it in the text or calculate the percentage.\n"
        "CRITICAL ARITHMETIC ALIGNMENT RULE: The Quantity multiplied by the Net Price (or Unit Price) should equal the Amount/Total. Use this to verify you have mapped the columns correctly! For example, if you see Qty=2 and Price=1.50, the Total must be 3.00. If your chosen Qty * Price does not match the Total printed on the page for that line item, YOU HAVE MAPPED THE COLUMNS WRONG and must try a different mapping. Ensure EVERY line item you extract is mathematically valid.\n"
        "ALCOHOL/BEVERAGE INVOICE RULE (GRA vs PRECIO): ONLY apply this rule if the invoice actually contains 'GRA.' or 'U/M' columns (e.g., wine/liquor distributors). On such invoices, you MUST NEVER confuse 'GRA.' (Alcohol %) or 'U/M' with the Price! The true Gross Price is under the 'PRECIO' column. If the invoice does NOT have 'GRA.' or 'U/M' columns, completely ignore this rule and extract the base value and unit price exactly as printed without modifying or subtracting anything.\n"
        "LINE ITEM QUANTITY RULE: If a table has multiple quantity-like columns (e.g. 'Cajas' vs 'UDS'/'CANTIDAD'), prefer the 'UDS' or 'CANTIDAD' column for the actual quantity, not the 'Cajas' column. Extract Gross Price as the exact printed price per that unit. DO NOT back-calculate the price.\n"
        "QUANTITY EXTRACTION: If a product description appears to end with a standalone number (e.g. 'MORITZ 7 1/3 24BOT RET 28'), that trailing number is almost always the QUANTITY column value that wrapped onto the same line as the description — extract it into 'quantity', not as part of the product name. Cross-check: quantity × gross_price - applied_discount should equal base (within 0.05). If it does not match with quantity=1, look for a wrapped/misplaced quantity digit in the description text and re-extract it.\n"
        "STRICT NO-INVENTION RULE: You MUST ONLY extract numbers that literally appear in the raw text! DO NOT perform calculations to generate/invent new numbers! If you see 3 decimal places (e.g. 5.702 or 1.198), extract them EXACTLY as printed. DO NOT round them to 2 decimals (e.g. 5.70 or 1.20)! If you invent a number or round a number that isn't exactly in the text, you fail.\n"
        "LINE ITEM SEPARATION RULE: Do NOT merge multiple distinct products into a single row's description. Keep each line item separate on its own row just as they appear in the source.\n"
        "UTILITY BILL RULE (ELECTRICITY/GAS): If the document is a multi-page utility bill and contains both a high-level summary of charges on the first page AND a detailed breakdown table on a later page (e.g., specific meter readings, distinct power periods, individual itemized fees), YOU MUST format the DETAILED BREAKDOWN as the Markdown table. Do NOT use the high-level summary for the table.\n"
        "MERGED NUMBERS RULE: OCR sometimes glues numbers together without spaces (e.g. '362,0921.076,04' or '173,4921,00'). You MUST intelligently split them apart based on expected columns. For example, '173,4921,00' means Base=173.49 and IVA Rate=21.00. Split them at the correct decimal boundaries.\n"
        "OCR NOISE RULE: OCR text may contain merged lines, broken tables, duplicated regions, missing spaces, and incorrect decimal separators. Use nearby text and repeated patterns to logically associate values across broken columns. However, NEVER invent or hallucinate information that cannot be reasonably linked.\n"
        "=== MESSY IVA / TOTALS SECTIONS ===\n"
        "If you see jumbled totals at the bottom (e.g., '173,4921,00', '36,43', '209,92') or in the Marginal Text (e.g., 'otal€ 209,92'), you MUST logically split the merged strings and properly populate the IVA breakdown table and the Totals section (Subtotal, Taxes, Grand Total). Do not leave the table empty if these values exist!\n"
        "B2B EXCLUSIVE TAX RULE (DEFAULT): On almost all B2B invoices, Line Item Prices DO NOT include IVA! The Amount/Total for a line item is strictly `Quantity * Gross Price` (minus discounts). DO NOT add IVA to the line item Amount. IVA is only added at the very end to the Subtotal.\n"
        "B2C INCLUSIVE TAX RULE: If the line items on the receipt INCLUDE tax (i.e., their sum equals the Grand Total rather than the Subtotal), you MUST explicitly label the Amount column as 'Amount (Inc. IVA)'. Do NOT hallucinate '0%' for the IVA % of fees like 'Canon' if it is not explicitly printed as 0%; either leave it blank or use the general rate.\n"
        "Do NOT hallucinate rows. Do NOT extract company logos or footers (like 'CONSERVAS ORTIZ') as line items if they have no valid quantity/price.\n"
        "IMPORTANT: You MAY extract 'Adjustments', 'Credits', 'Regulatory Operating Costs', 'DST Fees' or other additional fees as line items in the table IF they are printed as distinct rows with their own prices.\n"
        "PACKAGING/DEPOSITS EXCLUSION: If you see a section titled 'VALORACION ECONOMICA DE ENVASES' or similar containing lines like 'BOTELLA 1/3 LN RET' or 'PLASTICO VACIO' with negative/return quantities (e.g. '-21 CJ'), YOU MUST NOT extract them as products! Completely ignore these packaging deposit/return lines from the main Line Items table.\n"
        "=== META / FACEBOOK INVOICES ===\n"
        "Meta/Facebook ad invoices often print the Campaign name on one line, and the Ad Set sub-name on the next line WITH THE EXACT SAME PRICE REPEATED. (e.g. 'Campaña... €16.60' followed immediately by 'Nuevo conjunto... €16.60').\n"
        "DO NOT extract these as two separate items! The second line is just a sub-description. Only extract one line item for that €16.60 charge. The sum of the line items MUST equal the invoice subtotal.\n"
        "=== APPLE / LARGE BRAND B2C RETAIL RECEIPTS ===\n"
        "If the receipt is issued by a large consumer-electronics or retail store such as Apple, El Corte Inglés, MediaMarkt, Samsung, or similar:\n"
        "  • The store brand (e.g. 'Apple', 'Apple Passeig de Gràcia') IS the Supplier. Their legal entity and CIF (e.g. 'Apple Retail Spain, S.L.U.' / 'ESB65130643') are in the footer or header — extract them as supplier.name and supplier.vatID.\n"
        "  • The CUSTOMER is the buyer whose name/NIF appear under 'Nombre:', 'Facturar a:', or 'NIF:' in a dedicated customer block (e.g. 'Rec 67 Partners SL', NIF B67019018). If only one NIF/CIF is present in the document, extract it as supplier.vatID. Do NOT leave supplier.vatID empty if a NIF/CIF exists.\n"
        "  • 'Canon por copia privada' is a Spanish regulatory levy (Royal Decree) attached to electronic devices. It appears as a separate line item with a small price. Extract it as a real line item (not as taxableAdditionalCost) because it is already included in the printed Grand Total.\n"
        "  • All displayed item prices include IVA (B2C receipts). You MUST back-calculate the pre-tax unit price and extract it as `grossPrice` (e.g. grossPrice = printed_price / (1 + iva_pct/100)). Do NOT extract the tax-inclusive price as grossPrice! Also calculate `base = grossPrice * qty` so the sum of bases equals the invoice subtotal.\n"
        "  • The 'Artículo:' field on each line is the Apple part number — use it as `providerCode`.\n"
        "=== SUPPLIER vs CUSTOMER (READ THIS FIRST) ===\n"
        "You MUST identify the Supplier (seller) and the Customer (buyer) before doing anything else.\n"
        "For receipts from large retail brands (Apple, MediaMarkt, El Corte Inglés, Samsung, etc.):\n"
        "  • The STORE BRAND (e.g. 'Apple', 'Apple Passeig de Gràcia') is the SUPPLIER. Their legal entity + CIF (e.g. 'Apple Retail Spain, S.L.U., CIF ESB65130643') appear in the receipt footer/header. Extract as Supplier Name and Supplier VAT ID/CIF.\n"
        "  • The CUSTOMER is the person/company who BOUGHT: their name and NIF appear under 'Nombre:', 'Facturar a:', or 'NIF:' (e.g. 'Rec 67 Partners SL', NIF B67019018). Show as Customer Name. If only one NIF/CIF is present in the document, treat it as the Supplier's VAT ID.\n"
        "  • 'Canon por copia privada' IS a real line item (regulatory levy). Include it in the line items table.\n"
        "DO NOT redact the Supplier Name, Supplier VAT ID, or Customer Name — they MUST appear explicitly in the output.\n"
        "PRODUCT NAME CORRECTION: If the OCR text for a product description contains obvious spelling errors or garbled characters (e.g. 'Canon por oa rivada' instead of 'obra privada', or missing letters), you MUST gently correct the spelling to make it readable in the Markdown output.\n"
        "SUPPLIER NAME EXTRACTION: The supplier name is usually the largest text at the top, or explicitly labeled. DO NOT use abbreviations or truncate the name. Extract the FULL legal name.\n"
        "INVOICE SUBTOTAL VALIDATION: The sum of the 'Amount' column for all Line Items MUST strictly equal the Invoice Subtotal (within a few cents). If your extracted line items sum to 4155.30 but the Subtotal is 1658.00, YOU HAVE FAILED. You MUST re-read the OCR text and find the correct quantities and prices such that their sum matches the Subtotal.\n"
        "2. Identify the IVA/TAX BREAKDOWN section (which lists the tax rates, base amounts, and tax amounts). YOU MUST format this breakdown as a Markdown table (e.g. Rate, Base, IVA, Total). Even if the text is messy, do your best to extract it. Common IVA rates in Spain are 4%, 10%, and 21%. This is CRITICAL for data extraction downstream.\n"
        "3. Keep all the other information intact and well-structured using Markdown headings and lists. Be sure to explicitly extract the Supplier name, Supplier VAT ID/CIF, Customer name, Document Number, Date, Subtotal (of products only), ALL Taxes (e.g. IVA amounts), all Adjustments/Fees, and the Grand Total.\n"
        "=== DOCUMENT NUMBER vs CLIENT NUMBER ===\n"
        "In Spanish invoices, 'FACTURA', 'Nº FACTURA', or 'NUMERO' means Document Number (serialNumber). 'CLIENTE' or 'Nº CLIENTE' means Customer ID. You MUST extract the number next to 'FACTURA' or 'NUMERO' as the Document Number. DO NOT extract the 'CLIENTE' number as the Document Number!\n"
        "VAT ID RULE: If the document has a NIF/CIF/CIN ID (e.g. B-67019018 or B67019018), you MUST consider it as the Supplier's VAT ID and explicitly extract it as the Supplier's VAT ID, even if it is positioned near or under the Customer ('PARA' / 'CLIENTE') block. Do NOT redact it! Ensure it is included in the output as the Supplier's VAT ID (e.g. `VAT: B67019018`). If multiple VAT IDs are present, extract the one in the supplier logo/header as the Supplier's VAT ID, but if only one is present anywhere in the document, treat it as the Supplier's VAT ID.\n"
        "=== DATE PARSING ===\n"
        "=== TWO-COLUMN LAYOUT RULE (CRITICAL FOR SIDEWAYS SCANS) ===\n"
        "The raw text may contain a separator '--- DOCUMENT INFO COLUMN ---'. If present:\n"
        "  - Text BEFORE this separator = LEFT COLUMN.\n"
        "  - Text AFTER this separator = RIGHT COLUMN.\n"
        "CRITICAL: If the invoice is scanned sideways, the Line Items table will be SPLIT IN HALF by this separator! The left column will contain the Code, Description, and Quantity, while the right column will contain the Price, Discount, and Total for those exact same items. You MUST match the Nth product in the left column with the Nth price in the right column and merge them into a single row in your Markdown table.\n"
        "Do NOT confuse right-column numbers/codes with supplier or customer names.\n"
        "\n"
        "=== DISTRIBUTOR RECEIPT RULE ===\n"
        "Some Spanish delivery notes are from food/beverage distributors (e.g. Moritz, Estrella, Heineken). They print TWO company names in the header:\n"
        "  1. THE SUPPLIER: The distributor's legal company (e.g. 'DISTRIBUCIONES E.POZO S.L.') with 'C.I.F. B-XXXXXXX' attached directly on the same line or immediately after. This entity IS the Supplier.\n"
        "  2. THE CUSTOMER BLOCK: A block with a client account code (e.g. 'FAROLA · 397118'), street address, city, company name (e.g. 'REC 67 PARTNERS SL'), and a standalone 'NIF: BXXXXXXX' label line. This ENTIRE block belongs to the CUSTOMER.\n"
        "KEY RULE: A 'NIF:' or 'D.N.I.:' label on its own standalone line belongs to the CUSTOMER, but if there is no other C.I.F./N.I.F. printed on the document, it MUST be extracted/considered as the Supplier's VAT ID. The Supplier's CIF always appears directly after 'C.I.F.' on the same line as their legal company name if present, but falls back to any NIF/CIF present in the document if not.\n"
        "Do NOT extract the Customer's delivery account code as the document serial number.\n"
        "\n"
        "=== INTERLEAVED LINE ITEMS (LA RIBERA / ROTATED RECEIPTS) ===\n"
        "If you see this interleaved pattern where code, description, quantity, price and total are split onto different lines like:\n"
        "  1.750 1.75\n"
        "  08064313 1.000 10% 3.95\n"
        "  1344 LATORRE ANX.FCO.90 GR.x12 1.000 10% 3.950 2.18\n"
        "  6466 2.000 10% 1.090\n"
        "  C.I.F. 4449 MARCHAPAN PICOS RUSTICOS 200 GR.x10\n"
        "You MUST reconstruct 3 separate line items by matching codes to descriptions to quantities to prices:\n"
        "  - Code 08064313: product=RIERA FUET EXTRA MINI 50 GR.x30 (from marginal text), Qty=1.000, IVA=10%, Price=1.750, Total=1.75\n"
        "  - Code 1344: product=LATORRE ANX.FCO.90 GR.x12, Qty=1.000, IVA=10%, Price=3.950, Total=2.18 (price after discount)\n"  
        "  - Code 6466: product=MARCHAPAN PICOS RUSTICOS 200 GR.x10 (from C.I.F. 4449 line), Qty=2.000, IVA=10%, Price=1.090, Total=implied\n"
        "ALWAYS use the Marginal Text section to recover product names that are missing from main text!\n"
        "\n"
        "4. Output ONLY the reconstructed Markdown text. Do not add any conversational text or ```markdown fences.\n"
        "CRITICAL: Do NOT just echo the raw text! You MUST actively reformat and restructure it into Markdown tables and clear lists/headings.\n\n"
        "YOUR OUTPUT MUST EXACTLY FOLLOW THIS STRUCTURE (do not include the backticks):\n"
        "# Reconstructed Invoice\n\n"
        "## Supplier\n"
        "- **Name:** (extracted name)\n"
        "- **VAT ID:** (extracted vat id)\n\n"
        "## Customer\n"
        "- **Name / Code:** (extracted customer)\n\n"
        "## Invoice\n"
        "- **Number:** (extracted number)\n"
        "- **Date:** (extracted date)\n\n"
        "## Line Items\n\n"
        "| Code | Description | Quantity | Gross Price | Discount % | IVA % | Amount (Inc. IVA) |\n"
        "|------|-------------|----------|-------------|------------|-------|-------------------|\n"
        "| ...  | ...         | ...      | ...         | ...        | ...   | ...               |\n\n"
        "**Subtotal (products only):** ...\n\n"
        "**IVA breakdown**\n\n"
        "| Rate | Base | IVA | Total |\n"
        "|------|------|-----|-------|\n"
        "| ...  | ...  | ... | ...   |\n\n"
        "**Grand Total:** ...\n"
    )

    user_prompt = (
        "Here is the raw text to reconstruct into Markdown:\n\n"
        f"```text\n{raw_text}\n```\n"
    )

    try:
        response = _call_llm_with_fallback(
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
        )
        content = response.choices[0].message.content

        # Retry with a shorter prompt if model returned empty (context overload)
        if not content or not content.strip():
            logger.warning("LLM returned empty content for markdown formatting. Retrying with compact prompt.")
            compact_prompt = (
                "You are an invoice OCR formatter. Reformat the raw invoice text below into clean Markdown with:\n"
                "- ## Supplier (Name, VAT ID)\n"
                "- ## Customer (Name)\n"
                "- ## Invoice (Number, Date)\n"
                "- ## Line Items table: Code | Description | Qty | Price | IVA% | Amount\n"
                "- ## Totals (Subtotal, IVA, Grand Total)\n"
                "Output ONLY the Markdown, no fences, no commentary.\n"
                "IMPORTANT: Do NOT invent values. Only extract what is literally in the text.\n"
                "IMPORTANT: For sideways/rotated scans, codes and prices may be on separate lines — match them by order."
            )
            retry_response = _call_llm_with_fallback(
                temperature=0,
                messages=[
                    {"role": "system", "content": compact_prompt},
                    {"role": "user", "content": user_prompt}
                ],
            )
            content = retry_response.choices[0].message.content
            if not content or not content.strip():
                logger.error("LLM returned empty content for markdown formatting (both attempts).")
                return raw_text

        content = content.strip()
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

