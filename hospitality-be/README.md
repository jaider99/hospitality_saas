# Hospitality Decision Intelligence Backend (NestJS)

A production-ready, modular NestJS REST API backend powering the Hospitality SaaS platform. It integrates PostgreSQL via Prisma ORM, stores vector embeddings in **Qdrant Vector Database** for conversational chatbot context, caches hot endpoints and Siri assistant responses using **Redis**, and extracts invoice line details via Gemini 2.0 Flash.

---

## 🛠️ Stack & Technologies
* **Framework:** NestJS (Node.js)
* **Databases:** 
  * PostgreSQL (Relational inventory and labor logs)
  * **Qdrant** (Vector Database for similarity matching search context)
  * **Redis** (In-memory cache for chat answers and metrics)
* **AI Models:** Gemini 2.0 Flash & Gemini `text-embedding-004` (using the official `@google/genai` SDK)
* **Authentication:** JWT (JSON Web Tokens) with Passport

---

## 📂 Project Architecture

```
src/
├── main.ts (bootstrap server configurations, CORS, Validation)
├── app.module.ts (orchestrates feature modules imports)
├── prisma/
│   ├── prisma.service.ts (instantiates Prisma connection)
│   └── prisma.module.ts (exposes service globally)
├── redis/
│   ├── redis.service.ts (generic Redis cache manager client)
│   └── redis.module.ts (exposes Redis service globally)
├── auth/ (JWT strategies, roles filters, sign-ins)
├── ai/
│   ├── ai.service.ts (Gemini invoice extractor and Siri Chatbot RAG router)
│   ├── qdrant.service.ts (Qdrant collection creation and vector queries)
│   └── ai.module.ts (coordinates AI services and controllers)
├── invoices/ (scans upload buffers and Fuzzy maps products to inventory cost)
├── recipes/ (calculates menu pricing ratios and margin threshold alerts)
├── labor/ (clock-in metrics, payroll tracking, staffing size advisor)
└── incidents/ (logs supplier cost spike and labor cost exceptions)
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have **Node.js 20+**, **Yarn**, and **Docker / Docker Compose** installed.

### 2. Launch Local Database & Caching Services
Start the database containers (Postgres, Qdrant, Redis) in the background:
```bash
docker compose up -d
```
* **PostgreSQL** runs on port `5432`
* **Qdrant Vector DB** runs on port `6333` (Dashboard visible at `http://localhost:6333/dashboard`)
* **Redis Cache** runs on port `6379`

### 3. Configure Environment
Copy the example file to `.env`:
```bash
cp .env.example .env
```
Update credentials inside `.env` to match your local setup:
* **`DATABASE_URL`**: `postgresql://postgres:postgres@localhost:5432/hospitality?schema=public`
* **`QDRANT_URL`**: `http://localhost:6333`
* **`REDIS_URL`**: `redis://localhost:6379`
* **`GEMINI_API_KEY`**: Obtain a developer API key from [Google AI Studio](https://aistudio.google.com/).

### 4. Install Dependencies
Run the installation script:
```bash
yarn install
```

### 5. Push Relational Database Schema
Sync your PostgreSQL database with the Prisma models:
```bash
npx prisma db push
```

### 6. Start Development Server
Start the NestJS dev watcher:
```bash
yarn start:dev
```
The API endpoints will be accessible at: `http://localhost:8000/api/v1`

---

## 🐳 Running inside Docker Containers
To build and run the entire server inside a container:
```bash
# Build the Docker image
docker build -t hospitality-backend .

# Run the container (injecting appropriate configuration settings)
docker run -d \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/hospitality?schema=public" \
  -e QDRANT_URL="http://host.docker.internal:6333" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  -e GEMINI_API_KEY="your-gemini-key" \
  --name hospitality-api \
  hospitality-backend
```

---

## 🔗 REST API Endpoint Reference

### 🔐 Authentication (`/auth`)
* `POST /auth/register` - Create a new user account.
* `POST /auth/login` - Validate credentials (returns JWT string `accessToken`).
* `GET /auth/me` - Fetch details of active logged in profile.

### 🧾 Invoice Uploads (`/invoices`)
* `POST /invoices/upload` - Multimodal VLM OCR extraction. Accepts PDF or Image file under key `file`. Maps items and auto-calculates supplier cost hike changes, indexing invoice summaries inside Qdrant automatically.
* `GET /invoices` - Retrieve all invoices.
* `GET /invoices/:id` - Fetch detailed information about an invoice (including matching lines).

### 🍳 Recipe Margins (`/recipes`)
* `POST /recipes` - Create a new menu recipe.
* `GET /recipes` - Fetch all recipes, complete with portion costs, profit margins, cost percentages, and warning statuses.
* `POST /recipes/:id/ingredients` - Link a catalog ingredient to a recipe.
* `DELETE /recipes/ingredients/:ingredientId` - Remove an ingredient from a recipe.

### 👥 Staffing & Labor Costs (`/labor`)
* `POST /labor/staff` - Register a staff member with a target hourly pay rate.
* `POST /labor/clock-in` - Log clock-in time.
* `POST /labor/clock-out` - Complete shift work, calculating total hours and pay.
* `POST /labor/audit` - Evaluate active shifts against daily sales (creates incident suggestions like "increase chef" or "remove waiter" if costs exceed target boundaries).

### ⚠️ Exception Tracker (`/incidents`)
* `GET /incidents` - View all active operational incident logs (price spikes, labor issues).
* `PUT /incidents/:id/resolve` - Mark an exception incident as resolved.

### 🤖 AI Siri Chatbot Assistant (`/ai`)
* `POST /ai/chat` - Queries the chatbot database using RAG, searching the Qdrant database for matches and utilizing Redis to cache hot queries. Returns voice-assistant format responses.
* `GET /ai/insights` - Returns general proactive restaurant recommendations.
