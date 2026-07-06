# Product Detection, Pricing, and Measurement Guide

This document explains the technical implementation and workflows behind how the system detects products, calculates prices, and processes quantity measurements.

---

## 1. How the System Detects & Maps Products

Products enter the system through digitizing scanned or uploaded invoices. The mapping flow proceeds in three stages:

### A. Extraction (OCR & AI Ingestion)
1. The invoice file (PDF/Image) is uploaded and processed by the OCR pipeline (`app/ocr/pipeline.py`).
2. OCR and LLM processors extract the raw line items, capturing fields like:
   - `description` (e.g. *"Premium milk box 6x1L"*)
   - `unit` (e.g. *"box"*)
   - `quantity` (e.g. *3.0*)
   - `unit_price` (e.g. *6.50*)
   - `total_price` (e.g. *19.50*)
3. These raw lines are saved in the `invoice_lines` table as "unlinked" items.

### B. Similarity Recommendation
When users view the **Review Queue** (`/dashboard/review`), the backend recommends matches from the existing catalog by executing `_find_similar_products`:
- It extracts a prefix of the incoming description (the first 15 characters).
- It performs a case-insensitive lookup (`Product.name.ilike(f"%{prefix}%")`) against catalog products.
- It assigns a **Confidence Score** to matches:
  - **`exact`**: The description matches the catalog product name exactly.
  - **`possibly_different`**: The first 10 characters match.
  - **`looks_different`**: The prefix matched but characters differ.

### C. Catalog Integration
- **Unify**: If the user links the line to an existing catalog product, the system creates a `ProductReference` and `ReferencedItem` junction record, and merges its stats into the product.
- **No Match**: If it's a new item, the system creates a new standalone catalog product using the line's details.

---

## 2. How Product Price & Statistics Work

The catalog page displays four key pricing and spending metrics:

### A. Dynamic vs. Static Statistics
- **Default (Lifetime View)**: When no date filter is applied, the system returns pre-computed static columns on the `products` table (`products.total`, `products.quantity`, `products.last_price`) updated during unification.
- **Filtered (Date Range View)**: When a date filter is applied, the backend queries `invoice_lines` within that range and dynamically sums the totals to prevent displaying lifetime metrics.

### B. Mapped Price Definitions
1. **Latest Price (`last_price`)**: Mapped to the `unit_price` of the most recent invoice line unified to the product.
2. **Total Spend (`total`)**: Calculated as the sum of `total_price` across all unified invoice lines.
3. **Reference Price (`reference_price`)**: Mapped to a baseline price configured in the product options to identify price spikes. It supports three settings:
   - **Weighted Average Price**: Sum of total price divided by total quantity across matching historical lines.
   - **Price of the Last Purchase**: Equal to the most recent purchase price.
   - **Custom amount**: A manually-established threshold set by the user.
4. **Fixed Price**: Mapped to a default price utilized in new digitized documents if the invoice line lacks a price.

---

## 3. How Quantity & Measurement Formats Work

The application supports purchasing products in bulk packaging formats while tracking them in base inventory units:

### A. base units (`unit_of_measure`)
Each catalog product is assigned a base unit of measure (e.g., `kg`, `l`, `gr`, `ud`). All inventory logs and recipes evaluate ingredients in this base unit.

### B. Product Formats (`ProductFormat`)
A single product can be purchased from suppliers in multiple configurations (e.g., box, crate, bottle). The system maps these using the `ProductFormat` table:
- **`purchase_unit`**: The unit in which the item was purchased (e.g. `box`).
- **`conversion_factor`**: The multiplier to convert the purchase unit into the base unit.
- **`base_unit`**: The product's base unit.

$$\text{Base Unit Quantity} = \text{Purchase Unit Quantity} \times \text{Conversion Factor}$$

#### Example: CARASATU bread (400g pack)
- Base Unit: `gr` (grams)
- Format Mapped: `purchase_unit = "ud"`, `conversion_factor = 400.0`, `base_unit = "gr"`
- A purchase of **2 units (ud)** converts to:

$$2 \text{ ud} \times 400 = 800 \text{ gr}$$

- Mapped price per base unit:

$$\text{Price per Base Unit (gram)} = \frac{\text{Price per purchase unit (ud)}}{\text{Conversion Factor}}$$
