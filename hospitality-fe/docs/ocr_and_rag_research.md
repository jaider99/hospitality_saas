# OCR & Hybrid RAG Architecture Research & Development Report

This report defines the engineering specification for the **Invoice OCR Parser** and the **Hybrid RAG Virtual Assistant** in the Hospitality SaaS platform. It aligns research benchmarks with our actual implemented backend stack.

---

## 1. OCR Extraction: Tech Comparison & Gemini Pipeline

Hospitality invoices, receipts, and delivery slips are highly unstructured, frequently printed on low-quality paper, and contain supplier-specific product codes or local abbreviations (e.g. `"GIN HEN 70CL"` instead of `"Hendrick's Gin"`).

### OCR Method Benchmarks

| Metric | Traditional OCR (Tesseract / EasyOCR) | Specialized OCR (Document AI / Textract) | Multimodal VLM (Gemini 2.0 Flash) |
| :--- | :--- | :--- | :--- |
| **Parsing Strategy** | Regex/Rule-based template matching | Layout-specific invoice templates | Schema-bound context generation |
| **Shadows & Wrinkles** | Fails / Corrupts character layout | Modest recovery | Excellent semantic correction |
| **Vendor Variance** | Requires custom templates per supplier | Decent, but breaks on custom layouts | Zero template setup required |
| **Outputs** | Raw bounding box characters | Structured forms & key-value fields | Native JSON typed to schema |
| **R&D Recommendation** | ❌ Low Feasibility | ⚠️ Medium Feasibility (High Cost) | **⭐⭐⭐ High Feasibility (Best Choice)** |

---

### Gemini 2.0 Flash Parsing Pipeline

Our backend leverages **Gemini 2.0 Flash** via the `@google/genai` client. It processes files directly as inline base64 documents and returns strict schema-compliant JSON structures.

#### Data Schema Definition (Zod Equivalent for Backend)
```json
{
  "type": "OBJECT",
  "properties": {
    "invoiceNumber": { "type": "STRING" },
    "supplierName": { "type": "STRING" },
    "issueDate": { "type": "STRING", "description": "ISO 8601 date string" },
    "totalAmount": { "type": "NUMBER" },
    "lines": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "description": { "type": "STRING" },
          "quantity": { "type": "NUMBER" },
          "unitPrice": { "type": "NUMBER" },
          "totalPrice": { "type": "NUMBER" },
          "sku": { "type": "STRING", "description": "Product SKU if visible" },
          "unit": { "type": "STRING", "description": "e.g. kg, litre, case, bottle" }
        },
        "required": ["description", "quantity", "unitPrice", "totalPrice"]
      }
    }
  },
  "required": ["invoiceNumber", "supplierName", "issueDate", "totalAmount", "lines"]
}
```

---

## 2. Hybrid RAG System: Query Classification & Routing

Hospitality managers query information across two different domains:
1. **Relational / Analytical Spends:** *"What did I spend on beverage suppliers last week?"* or *"Did Hendrick's Gin price increase?"*
2. **Conceptual / Policy Guidelines:** *"What are the credit terms for short deliveries from Beverage Source?"* or *"Who do I contact for food safety audits?"*

To handle both, the chatbot implements a **Hybrid Router RAG** architecture:

```
                            [User Chat Query]
                                    │
                         [Query Intent Router]
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼ (Relational / Metrics)                    ▼ (Semantic / Policy)
          [Text-to-SQL]                              [Vector Embedding]
              │                                           │
   [Query PostgreSQL database]                   [Query Qdrant Database]
              │                                           │
              └─────────────────────┬─────────────────────┘
                                    ▼
                          [Context Assembler]
                                    │
                          [Gemini Reasoner]
                                    │
                          [Response to Client]
```

---

## 3. Vector Database Storage (Qdrant)

We utilize **Qdrant** as our vector search database instead of `pgvector` to isolate semantic query retrieval from relational transaction processing.

### Collection Configuration: `hospitality_embeddings`
* **Vector Dimension Size:** `768` (exactly matching Gemini `text-embedding-004` output).
* **Distance Metric:** `Cosine` distance.
* **Point Identification:** Deterministic 32-bit integer generation using hash keys for string identifiers.

### Document Indexing Pipeline
When an invoice is successfully processed, the backend compiles a descriptive paragraph of the invoice text:
> *"Invoice #SUPP-9812 from Supplier 'Beverage Source Ltd' issued on 2026-06-24 with total amount $38.40. Products itemized: Hendrick's Gin, Tonic Water Case."*

This paragraph is converted to a vector using `text-embedding-004` and upserted to Qdrant with payload metadata containing references to the original tables.

---

## 4. Query Performance & Redis Caching

To optimize chatbot responsiveness and save API costs, we wrap our RAG answers in a **Redis Caching Layer**:

1. **Cache Key Structure:** `cache:chat:<lowercased_query_with_underscores>`
2. **Execution Flow:**
   * User query hits the chat service.
   * Service checks Redis for the cache key.
   * **Cache Hit:** Returns response string directly (latency < 5ms).
   * **Cache Miss:** Runs Gemini embedding search $\rightarrow$ Queries Qdrant and live DB $\rightarrow$ Generates Gemini response $\rightarrow$ Saves to Redis with **60-second TTL** $\rightarrow$ Returns response.
