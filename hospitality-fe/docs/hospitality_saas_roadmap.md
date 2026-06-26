# Hospitality SaaS Roadmap (July – December)

## Executive Summary & Strategic Objective
Between **July and December**, the primary focus of the platform is to lock in and optimize the first high-value operational feedback loop. We connect supplier receipts and invoices directly to recipe costing, highlighting price hikes, waste tracking, and labor audit leaks via a Siri-style AI reasoning assistant.

```
Supplier Invoices / Delivery Tickets
   └── 💸 Supplied Product Costs (Postgres)
        └── 📈 Real-Time Price Hikes (Incidents Log)
             └── 🍳 Recipe Margin Recalculation (Prisma)
                  └── 🤖 AI Insight Briefings (Gemini 2.0 Flash + Qdrant + Redis)
```

---

## 🎯 Product Vision & Core Pains Addressed

### Vision Statement
> To give every hospitality operator—from independent cocktail bars to expanding multi-location brands—the same operational intelligence that only enterprise groups afford, delivered via a mobile-first, zero-template product.

### Core Pains Addressed

1. **Food & Beverage Cost Leakage:** Suppliers raise prices silently. Invoices enter the business, but recipes and menu prices are rarely updated in time. The system automatically detects these price spikes (if change $\ge$ 5%) and recalculates recipe portions.
2. **Unproductive Waste Logging:** Raw food spoilage or kitchen/bar wastage remains unrecorded, bloating standard Cost of Goods Sold (COGS). We implement simple waste tracking to capture losses.
3. **Labor Cost Creep:** Scheduling staff members by intuition leads to overstaffed quiet shifts and understaffed peak hours. The labor audit service compares shift payroll schedules against sales revenues to detect cost ratio exceptions.
4. **Administrative Fatigue:** Managers spend hours recalculating recipe costs in Excel or sorting through paper bills. We automate extraction and matching via AI.

---

## 👥 Value Proposition by User Type

| Role | Primary Need | Value Provided by the App |
| :--- | :--- | :--- |
| **Owners** | Profitability & Scale | Early alerts on margin leaks, year-over-year spend comparisons, anomaly logs, and reduced spreadsheet dependency. |
| **General Managers** | Speed & Clarity | Daily operational briefs, invoice matching reviews, and real-time labor cost ratios. |
| **Chefs / Bar Managers** | Cost Control | Instant recipe margin recalculation, portion batch costings, and catalog price checks. |
| **Finance / Admin** | Traceability | Auto-extracted line items, organized supplier files, and clear credit dispute notes. |

---

## 📅 Technical Roadmap (July – December)

### 📅 July — Core System MVP Lock
* **Objective:** Establish the baseline monorepo integration and seed initial database tables.
* **Milestones:**
  * Define Prisma schema with autoincrement integer keys for `User`, `Supplier`, `SuppliedProduct`, `Recipe`, `Invoice`, `StaffMember`, and `OperationalIncident`.
  * Scaffold NestJS controllers for `/auth`, `/invoices`, `/recipes`, `/labor`, and `/incidents`.
  * Build the shared validation library using Zod and shared typescript models.
  * Connect Redis cache services and Qdrant client services.

### 📅 August — OCR & Catalog Matching
* **Objective:** Deploy the invoice parsing and catalog mapping pipeline.
* **Milestones:**
  * Implement Gemini 2.0 Flash multimodal image extraction (`POST /invoices/upload`).
  * Design the client-side uploader on both the Next.js web dashboard and the Expo React Native app.
  * Develop the matching algorithm inside the backend service to link raw parsed lines to SuppliedProduct records.
  * Log price histories in the database on successful invoice processing.

### 📅 September — Recipes, Waste & RAG Chatbot
* **Objective:** Map products to recipe structures and launch the Virtual Siri Assistant.
* **Milestones:**
  * Implement recipe margin recalculations: when a product cost changes, instantly update ingredient costs for all linked recipes.
  * Create high-priority `OperationalIncident` alerts for price spikes and recipe cost warnings.
  * Enable RAG Chatbot searches using Gemini embeddings (`text-embedding-004`) inside Qdrant and cached responses in Redis.
  * Build the virtual chat interface in both web and mobile clients, including Native Mobile speech-to-text triggers.

### 📅 October — Labor Auditing & Exceptions Dashboard
* **Objective:** Integrate employee tracking and schedule audits.
* **Milestones:**
  * Launch staff scheduling and shift clock-in/out endpoints.
  * Build the labor audit mechanism (`POST /labor/audit`) calculating active cost ratios against daily estimated sales, flagging alerts above 30%.
  * Implement the exceptions log UI `/dashboard/incidents` to manage disputes and mark incidents resolved.
  * Optimize dashboard load performance and layout responsiveness.

### 📅 November & December — Pilot Testing & Pricing
* **Objective:** Run live venue pilots, fix edge cases, and launch pricing plans.
* **Milestones:**
  * Connect live Point-of-Sale (POS) system webhooks to automatically decrement stock levels.
  * Implement supplier credit dispute forms and PDF invoice dispute exports.
  * Establish pricing tiers for single-location venues and multi-unit groups.
