# Hospitality Decision Intelligence Backend: Project Details

Welcome to the backend API services documentation for the **Hospitality Decision Intelligence** SaaS platform. This application is built as a modular **NestJS** server, connecting to **PostgreSQL** via **Prisma ORM**, integrating **Qdrant** as the vector search engine, and employing **Redis** for hot-caching queries and chatbot answers.

---

## 🗺️ Table of Contents
1. [Backend Objectives & Automation Workflows](#backend-objectives--automation-workflows)
2. [Systems Architecture](#systems-architecture)
3. [Database Models (Prisma SQL Layout)](#database-models-prisma-sql-layout)
4. [Qdrant Vector Database Integration](#qdrant-vector-database-integration)
5. [Redis Caching Layer](#redis-caching-layer)
6. [API Route References](#api-route-references)
7. [Running the Application](#running-the-application)

---

## Backend Objectives & Automation Workflows

Operating costs in hospitality are highly sensitive to market fluctuations. This backend automates critical margin protection checks:

### 1. Invoice Parsing & Catalog Pricing Spike Warnings
* Files uploaded to `/invoices/upload` are processed by **Gemini 2.0 Flash**.
* Suppliers are auto-created/linked. Line items are mapped to products.
* If a product price increases by **5% or more**, the system automatically logs a `PRICE_HIKE` incident.
* If a price spike affects menu item recipes, portion margins are recalculated, and a high-severity alert warns the manager if margins drop below the target thresholds.

### 2. Labor Cost Audits
* Shift data is clocked in/out via `/labor/clock-in` and `/labor/clock-out`.
* The `/labor/audit` endpoint audits active payroll shifts against estimated sales.
* If labor costs exceed **30% of sales**, the system creates a `LABOR_COST` incident recommending shift optimizations (e.g., *"remove waiter"* or *"reduce chef hours"*).
* If labor falls below **15%**, it warns of potential service delays due to understaffing.

---

## Systems Architecture

The backend is structured to isolate modules while sharing a global database and caching middleware:

```
src/
├── main.ts (Bootstrap configuration, CORs, Validation pipes)
├── app.module.ts (Core module declarations)
├── prisma/
│   ├── prisma.service.ts (Prisma client lifecycle connection hooks)
│   └── prisma.module.ts (Exposes Prisma globally)
├── redis/
│   ├── redis.service.ts (Handles caching, gets, sets, and expirations)
│   └── redis.module.ts (Exposes Redis globally)
├── auth/ (JWT signing, Passport strategies, roles-based route guards)
├── ai/
│   ├── ai.service.ts (Structured invoice parsing & Siri RAG Chatbot query handling)
│   ├── qdrant.service.ts (Collection initialization & Cosine vector searches)
│   └── ai.module.ts (Combines Gemini and Qdrant controllers)
├── invoices/ (Multipart multer uploads, fuzzy matching, and price spikes alerts)
├── recipes/ (Portion pricing calculations, margin checkers, ingredients binding)
├── labor/ (Clock-in logging, payroll ratios audit, staffing advisors)
└── incidents/ (System exception registry and resolution states)
```

---

## Database Models (Prisma SQL Layout)

Configured at [schema.prisma](file:///Users/nidhigokani/Documents/hospitality-be/prisma/schema.prisma):

| Model Name | Field Summary | Description / Relationships |
| :--- | :--- | :--- |
| **`User`** | `id`, `email`, `password`, `name`, `role` | System user database credentials. Supports roles: `ADMIN`, `MANAGER`, `STAFF`. |
| **`Supplier`** | `id`, `name`, `contactInfo` | Vendor information. Relates to many products and invoices. |
| **`SuppliedProduct`** | `id`, `name`, `sku`, `supplierId`, `currentPrice`, `unit` | Item master catalog. Links to Supplier, cost histories, invoice lines, and recipes. |
| **`ProductCostHistory`**| `id`, `productId`, `price`, `changedAt` | Tracks cost variations. Every price spike adds a history log. |
| **`Recipe`** | `id`, `name`, `targetCostPercentage`, `salePrice`| Menu item recipe definitions containing target cost constraints. |
| **`RecipeIngredient``**| `id`, `recipeId`, `productId`, `quantity` | Quantity amount of product ingredients used within a specific menu recipe. |
| **`Invoice`** | `id`, `invoiceNumber`, `supplierId`, `issueDate`, `totalAmount`, `status` | Scanner invoice files index record. |
| **`InvoiceLine`** | `id`, `invoiceId`, `description`, `quantity`, `unitPrice`, `totalPrice`, `productId`| Parsed invoice lines, mapped to SuppliedProduct. |
| **`StaffMember`** | `id`, `name`, `role`, `hourlyRate` | Employee records (e.g., CHEF, WAITER) and hourly base rates. |
| **`StaffShift`** | `id`, `staffId`, `clockIn`, `clockOut`, `totalHours`, `totalPay` | Shift logs with calculated hours and pay. |
| **`OperationalIncident``**| `id`, `type`, `severity`, `message`, `status` | Exceptions dashboard log (PRICE_HIKE, LABOR_COST, WASTE). |
| **`AIInsight`** | `id`, `title`, `content`, `category` | Proactive recommendations. |

---

## Qdrant Vector Database Integration

Conversational intelligence context search resides in **Qdrant**:
* **Embedding Model**: Text chunks are passed to Gemini `text-embedding-004` to create 768-dimensional vectors.
* **Vector Storage**: Summarized invoice events and uploaded operational guides are indexed inside the `hospitality_embeddings` collection with Cosine similarity scoring.
* **Semantic Search**: Chat queries are vectorised and matched against Qdrant records to inject relevant document excerpts into the Chatbot prompt.

---

## Redis Caching Layer

An in-memory **Redis** cache optimizes system speed:
* **Chatbot Queries**: Chatbot answers for identical queries are stored in Redis (`cache:chat:<query_hash>`) with a **60-second expiration**, reducing Google GenAI API overhead.
* **Session and Configs**: Key indicators can be cached to prevent redundant DB reads.

---

## API Route References

| Endpoint Method & Path | Auth Required | Purpose / Behavior |
| :--- | :--- | :--- |
| **`POST /api/v1/auth/register`** | No | Registers user, hashes password via bcrypt. |
| **`POST /api/v1/auth/login`** | No | Validates credentials, returns JWT. |
| **`GET /api/v1/auth/me`** | Yes (JWT) | Access user session profile details. |
| **`POST /api/v1/invoices/upload`**| Yes (JWT) | Multer upload (key: `file`). Scans invoice, updates cost records, and checks margin leaks. |
| **`GET /api/v1/invoices`** | Yes (JWT) | List invoices. |
| **`GET /api/v1/invoices/:id`** | Yes (JWT) | Detailed view of invoice lines. |
| **`POST /api/v1/recipes`** | Yes (JWT) | Create menu item recipe. |
| **`GET /api/v1/recipes`** | Yes (JWT) | Lists recipes with actual cost ratios. |
| **`POST /api/v1/recipes/:id/ingredients`**| Yes (JWT) | Attach ingredient link. |
| **`POST /api/v1/labor/staff`** | Yes (JWT) | Register staff profile. |
| **`POST /api/v1/labor/clock-in`** | Yes (JWT) | Shift clock-in. |
| **`POST /api/v1/labor/clock-out`** | Yes (JWT) | Shift clock-out, calculates pay. |
| **`POST /api/v1/labor/audit`** | Yes (JWT) | Run daily sales staffing ratio test. |
| **`GET /api/v1/incidents`** | Yes (JWT) | Retrieve open system incidents. |
| **`PUT /api/v1/incidents/:id/resolve`**| Yes (JWT) | Mark alert as resolved. |
| **`POST /api/v1/ai/chat`** | Yes (JWT) | Siri Chatbot vector RAG solver (caching via Redis). |
| **`GET /api/v1/ai/insights`** | Yes (JWT) | Retrieve system optimization ideas. |

---

## Running the Application

Ensure database, caching, and embedding containers are running:
```bash
# Start Postgres, Qdrant, and Redis
docker compose up -d

# Sync Database Models
npx prisma db push

# Start Backend Server
yarn start:dev
```
The application will boot at `http://localhost:8000/api/v1`.
