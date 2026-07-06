# Invoice OCR Pipeline — Technical Documentation

> **Codebase:** `app/ocr/`
> **Entry point:** `worker.py → process_invoice_task()` → `pipeline.py → process_invoice()`

---

## Overview

When a user uploads an invoice the system runs a **multi-stage extraction pipeline**:

```
Upload → MinIO Storage → ARQ Worker → OCR Pipeline → PostgreSQL
                                            │
                               ┌────────────▼────────────────┐
                               │  Stage 0   · Ingest          │  PaddleOCR / pdfplumber
                               │  Stage 1   · Regex           │  deterministic, free
                               │  Stage 1.5 · Table Extract   │  PP-StructureV3
                               │  Stage 2   · LLM Fallback    │  GPT-OSS 120B (OpenRouter)
                               │  Stage 2.5 · VL Fallback     │  Nemotron Vision (NVIDIA)
                               │  Stage 3   · Validate        │  arithmetic + completeness
                               └─────────────────────────────┘
```

The result is a structured `Invoice` object saved to **PostgreSQL** and surfaced to the front-end via a webhook.

---

## Full Data Flow

```
User
 │  POST /invoices  (PDF / image)
 ▼
API Server
 │  store file ──────────────────────────► MinIO  (object_key)
 │  enqueue ──────────────────────────────► Redis (ARQ): process_invoice_task(invoice_id, object_key)
 │  return 202 Accepted
 ▼
ARQ Background Worker  (max_jobs = 1)
 │  download file from MinIO → /tmp/…
 │  call process_invoice(local_path, …)
 ▼
pipeline.py  ─  process_invoice()
 │
 ├─ Stage 0 · Ingest  (ingest.py)
 │    ├── Native PDF?   → pdfplumber              avg_conf = 1.0
 │    └── Scanned/Img?  → PaddleOCR PP-OCRv4      avg_conf = 0.0 – 1.0
 │              returns PageResult { raw_text, tokens, avg_confidence,
 │                                   is_native_text, page_images,
 │                                   low_conf_ratio, token_count }
 │
 ├─ Quality Gate  (triage.py)
 │    ├── avg_conf < 0.01  AND  token_count < 20  →  REVIEW ⚠  (early exit)
 │    └── looks_handwritten()                     →  REVIEW ⚠  (early exit)
 │
 ├─ Stage 1 · Regex Extract  (regex_extract.py)
 │    bilingual EN/ES keyword anchors + regex patterns
 │    returns partial Invoice object
 │
 ├─ Stage 1.5 · Table Extract  (table_extract.py)
 │    triggered only when inv.items is empty after Stage 1
 │    uses PP-StructureV3 to detect product line-item tables
 │
 ├─ Suspicious doc-number filter
 │    discards serial numbers that contain only label words (FACTURA, PEDIDO …)
 │
 ├─ Stage 2 · LLM Fallback  (llm_fallback.py)
 │    triggered when any required field is missing  OR  conf < 0.70  OR  no items
 │    model: GPT-OSS 120B via OpenRouter
 │    → extract_with_llm(ocr_text, missing_fields)
 │    → merge_llm_result_into_invoice()
 │
 ├─ Stage 2.5 · VL Fallback  (vl_fallback.py)
 │    triggered when OCR conf < 0.80  OR  LLM success score < 0.80
 │    model: Nemotron-3 Vision via NVIDIA API
 │    → extract_with_vl_model(image_bytes)
 │    → merge_llm_result_into_invoice()
 │
 ├─ Post-Extraction Processing
 │    ├── auto-heal line-item OCR typos (±€0.20 tolerance)
 │    ├── IVA bracket reconciliation  (Path A baked-in / Path B additive)
 │    ├── document type normalisation  (ES → EN)
 │    └── reconcile_totals_from_brackets()  (final safety pass)
 │
 ├─ Stage 3 · Validate  (validate.py)
 │    ├── required fields check
 │    ├── grand total arithmetic check   (±€0.02)
 │    ├── line items sum check           (±€0.02)
 │    ├── per-line arithmetic check
 │    ├── date sanity check
 │    ├── quantity verbatim check
 │    ├── supplier VAT backfill via DB lookup
 │    └── duplicate invoice check via DB
 │    computes final  llm_confidence  score
 │
 └─ save_invoice()  (storage.py / async_service.py)
      ├── supplier upsert
      ├── invoice record
      ├── line items  (bulk insert)
      └── tax brackets

Worker → POST /api/v1/invoices/webhook  {invoice_id, status: PROCESSED | FAILED}
Front-end updated via webhook / polling
```

---

## File Reference

| File | Stage | Responsibility |
|------|-------|---------------|
| `worker.py` | — | ARQ task runner; download from MinIO, call pipeline, trigger webhook |
| `ocr/pipeline.py` | all | **Main orchestrator** – calls each stage in order |
| `ocr/ingest.py` | 0 | PaddleOCR / pdfplumber text extraction; returns `PageResult` |
| `ocr/regex_extract.py` | 1 | Deterministic bilingual regex; no API calls |
| `ocr/table_extract.py` | 1.5 | PP-StructureV3 table/layout model for line items |
| `ocr/llm_fallback.py` | 2 | GPT-OSS 120B text extraction; JSON merge |
| `ocr/vl_fallback.py` | 2.5 | Nemotron vision extraction; image → JSON merge |
| `ocr/validate.py` | 3 | Arithmetic & completeness checks; `review_reasons` |
| `ocr/triage.py` | gate | Handwriting heuristic; writes `review_queue.jsonl` |
| `ocr/schema.py` | — | Data models: `Invoice`, `LineItem`, `Supplier`, `TaxBracket` |
| `ocr/storage.py` | — | SQLAlchemy ORM persistence to PostgreSQL |

---

## Stage 0 — Ingest (`ingest.py`)

### Decision Tree

```
File type?
├── PDF with extractable text layer  →  pdfplumber   (fast, free, avg_conf = 1.0)
├── Scanned PDF (no text layer)      →  PyMuPDF rasterize → PaddleOCR
└── Image  (jpg / png / webp)        →  PaddleOCR directly
```

### `PageResult` Fields

| Field | Type | Description |
|-------|------|-------------|
| `raw_text` | `str` | Full extracted plain text |
| `tokens` | `List[Token]` | Per-token bounding box + confidence |
| `avg_confidence` | `float` | 0.0–1.0 (1.0 = native PDF; OCR = average rec_score) |
| `is_native_text` | `bool` | `True` when pdfplumber was used |
| `page_images` | `List[ndarray]` | Rasterised page images (used by VL fallback) |
| `low_conf_ratio` | `float` | Fraction of tokens below the 0.55 cutoff |
| `token_count` | `int` | Total number of recognised tokens |

### PaddleOCR Settings

```python
PaddleOCR(
    use_angle_cls=True,           # corrects rotated / sideways scans
    ocr_version="PP-OCRv4",       # latest open-source models
    lang="latin",                 # Spanish accents + euro sign support
    text_det_limit_side_len=1536, # higher resolution detection
    show_log=False,
)
```

**Performance:** PaddleOCR is a lazy singleton (thread-safe double-checked locking).
When `IS_DOCKER=1`, the ONNX runtime backend is enabled automatically for a speed boost.

---

## Quality Gate — Hard Review Floor

Before calling any expensive table model or LLM the pipeline checks whether the OCR output is trustworthy.

### Early Exit Conditions

```python
HARD_REVIEW_FLOOR = 0.01   # practically blank / completely garbled

# Exit when BOTH:
inv.ocr_confidence < HARD_REVIEW_FLOOR  AND  page_result.token_count < 20

# OR heuristically looks handwritten:
looks_handwritten(avg_confidence, low_conf_ratio, token_count)
#   avg_conf < 0.55  AND  low_conf_ratio > 0.50  AND  token_count > 0
```

**When triggered:**
- `inv.needs_review = True`; reason added to `review_reasons`
- Entry appended to `review_queue.jsonl`
- Invoice saved to DB; pipeline returns early — no LLM call

> **Rationale:** Sending low-confidence OCR text to an LLM yields a confident-sounding answer on bad input, not a fix. Flagging for a human is more reliable.

---

## Stage 1 — Regex Extraction (`regex_extract.py`)

**Goal:** Cheap, deterministic field extraction using bilingual keyword anchors. No network calls.

### Core Patterns

| Field | Regex |
|-------|-------|
| Money | `(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s*€?` |
| Date | `(\d{1,2})(?:[/\-\s]|de)+([A-Za-z0-9]+)\.?(?:[/\-\s]|de)+(\d{2,4})` |
| VAT / CIF / NIF | `\b([A-Z]{1,2}\d{7,8}[A-Z0-9]?)\b` |

### Bilingual Keyword Dictionary (`schema.py → LABELS`)

| Field | Sample keywords |
|-------|----------------|
| `serialNumber` | `factura:`, `nº factura`, `invoice number`, `document:` |
| `date` | `date`, `fecha`, `fecha factura`, `invoice date` |
| `total` | `total`, `importe total`, `total a pagar`, `amount due` |
| `subtotal` | `base imponible`, `base imp.`, `net amount`, `subtotal` |
| `tax` | `iva`, `vat`, `cuota iva`, `importe iva` |
| `supplier.vatID` | `cif`, `nif`, `vat`, `tax id`, `n.i.f` |

### Money Format Normalisation

```
EU format:  1.234,56  →  1234.56   (. = thousands separator, , = decimal)
Anglo:      1,234.56  →  1234.56
Simple:       250,00  →   250.00
```

---

## Stage 1.5 — Table Extraction (`table_extract.py`)

**Triggered when:** `inv.items` is empty after the regex stage.

Uses PaddleOCR's **PP-StructureV3** layout model to locate product tables in the page image and parse them into `List[LineItem]` with `product`, `quantity`, `grossPrice`, `base`, `iva_pct`, etc.

---

## Suspicious Document Number Filter

After regex extraction the pipeline discards serial numbers that contain no digits or match a known label word:

```python
susp_vals = ["PEDIDO", "FACTURA", "ALBARAN", "TICKET", "ALBARÁN", "PRESUPUESTO"]
# If the extracted serial has no digit OR equals a label → inv.serialNumber = None
```

---

## Stage 2 — LLM Fallback (`llm_fallback.py`)

**Goal:** Fill remaining gaps using a large language model.

### Trigger (any one is sufficient)

- A required field is missing: `serialNumber`, `date`, `supplier.name`, `supplier.vatID`, or `total`
- `inv.ocr_confidence < 0.70`
- `inv.items` is still empty

### Configuration

| Setting | Default | Env var |
|---------|---------|---------|
| Model | `openai/gpt-oss-120b` | `LLM_MODEL` |
| Base URL | `https://openrouter.ai/api/v1` | `LLM_BASE_URL` |
| API key | — | `LLM_API_KEY` |
| Max tokens | `16384` | `LLM_MAX_TOKENS` |

### LLM Input

```
[structured OCR text]

=== RAW OCR TEXT ===
[page_result.raw_text]

=== BILINGUAL FIELD MAPPINGS ===
- serialNumber: factura:, nº factura, invoice number …
- date: date, fecha, …
```

### System Prompt Special Cases

| Document type | Rule |
|--------------|------|
| Meta / Facebook ad invoices | Campaign + Ad Set lines share the same price → extract as **one** item only |
| Apple / retail B2C receipts | Back-calculate pre-tax `grossPrice` from the tax-inclusive displayed price |
| Supplier vs Customer | Seller = Supplier; Buyer = Customer (store brand ≠ buyer name) |
| Credit-card receipts | MASTERCARD / VISA is **never** the Supplier Name |
| Spanish-specific fees | IRPF, Punto Verde, IBEE, albarán, recargo de equivalencia all mapped |

### Pre-LLM Total Sanity Check

If `subtotal + tax ≠ total` (difference ≥ €1.00) those three fields are reset to `0.0` and added to `missing_fields`, forcing the LLM to re-extract from scratch rather than anchor on wrong values.

### Post-LLM Adjustment Protection

After merging, if any adjustment field (`discount`, `payeAmount`, `greenPointAmount`, `ibeeAmount`, `taxableAdditionalCost`, `netAdditionalCost`) equals the grand total or subtotal (within €0.05) it is reset to `0.0`.

---

## Stage 2.5 — Vision-Language Fallback (`vl_fallback.py`)

**Goal:** When text-based extraction fails, read the invoice **image directly** using a vision model.

### Trigger (any one is sufficient)

- `ocr_confidence < 0.80` (`VL_OCR_THRESHOLD`)
- LLM extraction success score `< 0.80` (`VL_LLM_THRESHOLD`)
  - Score = `(required fields found / total required) − (0.25 × math_errors)`, min 0.0

### Configuration

| Setting | Default | Env var |
|---------|---------|---------|
| Model | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | `VL_MODEL` |
| Base URL | `https://integrate.api.nvidia.com/v1` | `VL_BASE_URL` |
| API key | — | `VL_API_KEY` / `NVIDIA_API_KEY` |
| Max tokens | `8192` | `VL_MAX_TOKENS` |

### Image Source Priority

1. Rasterised page images from PaddleOCR (numpy arrays → JPEG bytes via OpenCV)
2. Native PDF → rasterise with PyMuPDF at 200 DPI
3. Image file → raw bytes read directly

### Nemotron Quirks

| Quirk | Mitigation |
|-------|-----------|
| Echoes `"string\|null"` literally when given a type-annotated schema | Prompt uses a **concrete filled example** instead |
| Wraps chain-of-thought in `<think>…</think>` | Stripped via `re.sub(r'<think>.*?</think>', '', …, re.DOTALL)` |

---

## Post-Extraction Processing

### Auto-Heal Line-Item OCR Typos

```
expected_base = quantity × (grossPrice − appliedDiscount) + otherFees

if 0.01 < |expected_base − actual_base| ≤ 0.20:
    auto-correct actual_base  ← single-digit OCR typo (e.g. 0 → 5)
```

### IVA Bracket Reconciliation

Two structural invoice patterns are handled:

**Path A — Baked-in adjustments** (`brackets_total ≈ inv.total`)
- Discounts / Verde / ServLog are already in the taxable base
- Stored in `inv.observations` and zeroed on the invoice level
- `inv.subtotal` / `inv.tax` come from the brackets; `inv.total` is unchanged

**Path B — Additive adjustments** (`brackets_total ≠ inv.total`)
```
computed_total = brackets_total − discount + adj_fees
```
If the bracket subtotal appears to be the gross IMPORTE, the real net base is back-calculated from the printed total.

### Document Type Normalisation

| Spanish term | Normalised (EN) |
|---|---|
| `albarán`, `entrega` | `Delivery Note` |
| `crédito`, `credito` | `Credit Note` |
| `recibo`, `ticket` | `Receipt` |
| `pedido`, `orden` | `Purchase Order` |
| anything else | `Invoice` |

### Final Reconciliation

`reconcile_totals_from_brackets()` is the last pass. It ensures `inv.subtotal` and `inv.tax` are consistent with the tax brackets as the authoritative source of truth.

---

## Stage 3 — Validation (`validate.py`)

**Goal:** Run completeness and arithmetic checks; flag anything suspicious for human review.

### Required Fields

| Field | Condition |
|-------|-----------|
| `serialNumber` | must be present |
| `date` | must be present |
| `supplier.name` | must be present |
| `supplier.vatID` | must be present |
| `total` | must be `> 0` |

### Arithmetic Checks (tolerance €0.02)

**Grand total:**
```
expected = subtotal + tax
         − discount
         + payeAmount + greenPointAmount + ibeeAmount
         + taxableAdditionalCost − netAdditionalCost
```

**Line items sum:**
```
Σ(item.base) ≈ invoice.subtotal
```

**Per-line:**
```
quantity × (grossPrice − appliedDiscount) + otherFees ≈ item.base
```

**Other sanity checks:**
- **Date sanity** – parsed day must match `DD/MM/YY` in raw OCR text
- **Quantity verbatim** – quantity must appear literally in raw text (catches hallucinations)
- **Discount sanity** – `invoice.discount` must not equal a line-item `discountPct`

### LLM Confidence Score

```python
success_rate = required_fields_found / total_required
penalty      = min(len(review_reasons) * 0.25, 0.50)
llm_confidence = max(success_rate − penalty, 0.0)
```

### Post-Validation Enrichment

| Check | Action |
|-------|--------|
| Supplier name lacks legal suffix (S.L., S.A.U., INC., LTD., GMBH) | Flag for review |
| `supplier.vatID` missing but `supplier.name` known in DB | Backfill VAT ID from DB |
| `serialNumber` matches existing invoice in DB | `isDuplicate = True`, flag for review |

---

## Database Persistence (`storage.py`)

`save_invoice()` maps the `Invoice` DTO to PostgreSQL:

1. **Supplier upsert** — find or create `SupplierRecord` by `vatID`; update name / address if found
2. **Invoice record** — create or update `InvoiceRecord` with all extracted fields
3. **Line items** — bulk-insert `LineItemRecord` rows
4. **Tax brackets** — insert `TaxBracketRecord` rows

`async_save_ocr_invoice()` in `module/invoices/async_service.py` handles the async DB write from the ARQ worker context.

---

## Confidence Thresholds

| Constant | Value | Effect |
|----------|-------|--------|
| `HARD_REVIEW_FLOOR` | `0.01` | Below this + low token count → skip LLM, flag for human |
| `OCR_CONFIDENCE_THRESHOLD` | `0.70` | Below this → trigger LLM fallback |
| `VL_OCR_THRESHOLD` | `0.80` | Below this → trigger VL vision fallback |
| `VL_LLM_THRESHOLD` | `0.80` | LLM score below this → trigger VL fallback |
| `LOW_CONFIDENCE_CUTOFF` | `0.55` | Per-token threshold for `low_conf_ratio` |
| Handwriting: avg_conf | `< 0.55` | Part of `looks_handwritten()` heuristic |
| Handwriting: low_conf_ratio | `> 0.50` | Part of `looks_handwritten()` heuristic |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Text LLM API endpoint |
| `LLM_API_KEY` | — | OpenRouter API key |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Text LLM model |
| `LLM_MAX_TOKENS` | `16384` | Max tokens for LLM response |
| `VL_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Vision LLM endpoint |
| `VL_API_KEY` | — | NVIDIA API key (fallback: `NVIDIA_API_KEY`) |
| `VL_MODEL` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Vision model |
| `VL_MAX_TOKENS` | `8192` | Max tokens for VL response |
| `VL_OCR_THRESHOLD` | `0.80` | OCR confidence threshold to trigger VL |
| `VL_LLM_THRESHOLD` | `0.80` | LLM score threshold to trigger VL |
| `REVIEW_QUEUE_PATH` | `review_queue.jsonl` | Path for the human review log |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string (ARQ) |
| `IS_DOCKER` | `0` | Set to `1` to enable ONNX runtime backend |

---

## Review Queue (`review_queue.jsonl`)

Each flagged invoice appends one JSON line:

```json
{
  "file_path": "/tmp/invoice_6.pdf",
  "reason": "Missing Supplier VAT ID, Invoice totals do not add up correctly",
  "ocr_confidence": 0.62,
  "serial_number": "INV-2026-001",
  "items_found": 3,
  "raw_text_preview": "FACTURA SIMPLIFICADA …",
  "flagged_at": "2026-07-06T09:00:00"
}
```

---

## Debug Markdown Files

Each processed invoice produces `ocr_results/<base_name>_ocr.md` with three sections:

1. **Raw OCR text** — PaddleOCR / pdfplumber output immediately after ingest
2. **Items table** — Markdown table from PP-StructureV3 (only when a table is found)
3. **Final AI Extraction JSON** — complete `Invoice` DTO after all stages

---

## Worker Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `max_jobs` | `1` | PaddleOCR is CPU-bound; parallel jobs exhaust RAM and freeze the process |
| `job_timeout` | `900 s` (15 min) | First-run model downloads can take several minutes |
| Queue backend | Redis (ARQ) | Decouples upload from processing; survives server restarts |

---

## Known Edge Cases

| Case | Handling |
|------|----------|
| Rotated / sideways scans | `use_angle_cls=True` corrects rotation; if confidence remains low, VL fallback reads the image directly |
| Handwritten forms | Flagged by triage heuristic; not sent to LLM |
| Multiple documents in one photo | Table model may merge regions; VL fallback or human review covers this |
| Meta / Facebook ad invoices | LLM system prompt prevents duplicate extraction from Campaign + Ad Set same-price lines |
| Apple / retail B2C receipts | LLM back-calculates pre-tax `grossPrice` from tax-inclusive prices; store brand = supplier |
| Spanish locale numbers | `_parse_money()` handles both `1.234,56` and `1234.56` |
| Duplicate invoices | DB query by `serialNumber` before saving; `isDuplicate = True` when matched |
| Missing supplier VAT ID | DB lookup by supplier name before flagging for review |
