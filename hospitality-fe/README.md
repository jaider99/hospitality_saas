# Hospitality Decision Intelligence SaaS

This workspace contains the architecture, documentation, and implementation framework for the mobile-first Hospitality SaaS project.

## Project Structure

*   **`backend/`**: FastAPI (Python) backend application.
    *   `app/api/`: REST API endpoints and WebSockets for real-time mobile push notifications.
    *   `app/services/`: AI services including Multimodal VLM OCR extraction and pgvector RAG routers.
*   **`mobile/`**: Mobile Client App codebase (Flutter or React Native).
*   **`docs/`**: Technical research, flows, and architectures.
    *   [architecture_and_flows.md](file:///Users/nidhigokani/.gemini/antigravity-ide/scratch/hospitality_saas/docs/architecture_and_flows.md): Mermaid diagrams (architecture, sequence, database ER).
    *   [ocr_and_rag_research.md](file:///Users/nidhigokani/.gemini/antigravity-ide/scratch/hospitality_saas/docs/ocr_and_rag_research.md): Deep-dive into Gemini 2.0 Flash VLM and pgvector Hybrid RAG in Python.

---

## Backend Quick Start

### 1. Requirements
*   Python 3.10+
*   PostgreSQL with `pgvector` extension

### 2. Environment Setup
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/hospitality_db
GEMINI_API_KEY=your_google_ai_studio_api_key
```

### 3. Install Dependencies & Run
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
You can access the Swagger UI documentation at `http://localhost:8000/docs`.

---

## Architecture Highlight

1.  **VLM OCR Parser:** Uses Gemini 2.0 Flash's multimodal capabilities to extract structured items directly into a Pydantic object, bypass traditional OCR formatting problems.
2.  **Hybrid RAG Store:** Couples structured relational metrics (cost histories, margins) with unstructured chunks (contracts, vendor receipts) using a single PostgreSQL database powered by `pgvector`.
3.  **Real-Time Subscriptions:** Emits WebSocket notifications to the Mobile frontend as soon as background price-change detections or recipe margin calculations complete.
