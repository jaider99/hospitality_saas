# Product Merge Review — End-to-End Flow

## Overview

When a supplier invoice is uploaded and processed by OCR, the system automatically
tries to match extracted line items against existing products in the database.
Items that are clear new products are saved directly. Items that look similar to
an existing product are flagged for human review via the **Merge Review Queue**.

---

## Flow Diagram

```
Invoice Upload (PDF)
        │
        ▼
  OCR / Worker Container
  (async_service.py)
        │
        ▼
  Extract Line Items
  e.g. [{name: "Limones 5KG", price: 1.20}, ...]
        │
        ▼
  ┌─────────────────────────────────┐
  │   Two-Stage Product Matching    │
  │    (mapping_service.py)         │
  └─────────────────────────────────┘
        │
        ├─── Stage 1: Exact / Alias Match
        │       └── Found? ──► Link to existing product (no new row)
        │
        └─── Stage 2: LLM Semantic Match (GPT-4o)
                ├── LLM Match Found? ──► Create Product (PENDING_MERGE)
                └── No Match?        ──► Create Product (ACTIVE, brand new)
```

---

## Step-by-Step Breakdown

### Step 1 — Invoice Upload & OCR

- The user uploads a PDF invoice from the **Documents** page.
- The `worker` container (ARQ background job) picks it up and runs OCR via `async_service.py`.
- Raw line items are extracted with fields: `name`, `price`, `quantity`, `unit`, etc.

---

### Step 2 — Two-Stage Product Matching (`mapping_service.py`)

Before any product or invoice line is created in the database, all extracted items are
passed through `match_invoice_items(db, supplier_id, items)`.

#### Stage 1: Exact & Alias Match

1. Fetch all `ACTIVE` products for the given supplier from the `products` table.
2. Also fetch all known `product_aliases` linked to those products.
3. Lowercase and compare each invoice item name against:
   - Product names (e.g. `"tomato"`)
   - Alias names (e.g. `"tomates"` → mapped to `"Tomato"`)
4. If a match is found → `match_type = "exact"`, no new product is needed.

#### Stage 2: LLM Semantic Match

- All items that did **not** match in Stage 1 are sent to **GPT-4o** via OpenRouter.
- The prompt includes the full list of existing DB product names and asks the LLM to find semantic equivalents (synonyms, translations, abbreviations).
- Examples the LLM can catch: `"Aloo"` → `"Potato"`, `"Limones 5KG"` → `"Lemon"`, `"Tomates"` → `"Tomato"`.
- The LLM returns a confidence score (0–100) and its reasoning for each match.
- **Only high-confidence matches** are used (the LLM is instructed to return `null` if not sure).
- Result: `match_type = "llm"` (matched) or `match_type = "none"` (no match found).

---

### Step 3 — Database Records Created (`async_service.py`)

Based on the match result from Stage 2, a new `Product` row may be created:

| Match Type | Status Written to DB        | `suggested_master_product_id` |
|------------|-----------------------------|-------------------------------|
| `exact`    | No new product row created  | N/A                           |
| `llm`      | `PENDING_MERGE`             | Set to the matched product ID |
| `none`     | `ACTIVE`                    | `null` (brand new product)    |

After product rows are created, the legacy `invoice_lines`, `referenced_items`,
and `product_references` junction rows are also created for purchase history tracking.

---

### Step 4 — User Review Queue (Frontend)

The **Products** module shows a banner when `pending_review_count > 0`.

The review queue is fetched from:
```
GET /products/review-queue
```

This returns all `Product` rows where `status = "PENDING_MERGE"`, along with the
suggested master product they resemble.

#### User Actions

| Action               | API Call                                                        | Result                                                                                      |
|----------------------|-----------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| **Confirm Merge**    | `POST /products/review-queue/{lineId}/unify` with `{product_id}` | Merges the pending item into the master product. The `PENDING_MERGE` row is removed and the alias is saved. |
| **Reject / No Match** | `POST /products/review-queue/{lineId}/no-match`                | The item is promoted to `ACTIVE` as a standalone new product.                               |

---

## Database Tables Involved

| Table                | Role                                                                                    |
|----------------------|-----------------------------------------------------------------------------------------|
| `products`           | Core product table. The `status` column (`ACTIVE`, `PENDING_MERGE`) drives the review queue. |
| `product_aliases`    | Stores known name variants per product to improve future exact matching (e.g. `"Limones"` → `"Lemon"`). |
| `product_references` | Junction table linking a `Product` to one or more `ReferencedItem` rows (many-to-many). |
| `referenced_items`   | Raw invoice line records from Haddock or OCR. Has an FK to `invoice_lines`.            |
| `invoice_lines`      | The OCR-extracted line items per invoice document.                                      |
| `invoices`           | The parent invoice document record.                                                     |

---

## Key Files

| File                                              | Responsibility                                              |
|---------------------------------------------------|-------------------------------------------------------------|
| `app/module/invoices/async_service.py`            | Orchestrates OCR → matching → DB writes                    |
| `app/module/products/mapping_service.py`          | Two-stage matching logic (exact + LLM)                     |
| `app/module/products/model.py`                    | SQLModel definitions for all product-related tables         |
| `app/module/products/service.py`                  | Business logic for product CRUD and review queue operations |
| `app/module/products/router.py`                   | FastAPI routes for the products module                      |

---

## Product Status Reference

| Status           | Meaning                                                                 |
|------------------|-------------------------------------------------------------------------|
| `ACTIVE`         | A fully confirmed product. Either exactly matched or brand new.         |
| `PENDING_MERGE`  | The LLM found a likely match with an existing product. Awaiting human confirmation. |
