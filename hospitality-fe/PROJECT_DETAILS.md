# Hospitality SaaS Monorepo: Project Details

Welcome to the **Hospitality Decision Intelligence** SaaS platform frontend repository. This codebase is structured as a high-performance monorepo using **Yarn Workspaces** and **Turborepo** to share validation schemas, models, configs, and API layers between the Next.js Web App and the React Native Expo Mobile App.

---

## 🗺️ Table of Contents
1. [Platform Strategic Objective](#platform-strategic-objective)
2. [Monorepo Architecture](#monorepo-architecture)
3. [Tech Stack Overview](#tech-stack-overview)
4. [Shared Packages](#shared-packages)
5. [Applications](#applications)
6. [Getting Started & CLI Commands](#getting-started--cli-commands)
7. [Operational Exceptions Tracker](#operational-exceptions-tracker)
8. [AI Siri-Style Chatbot Assistant](#ai-siri-style-chatbot-assistant)

---

## Platform Strategic Objective

Margins in the hospitality industry are fragile. Most operators struggle not due to hospitality service quality, but because they make purchases and staffing decisions with late, incomplete, or manual information. 

This platform closes that gap by automating the operational feedback loop:
```
Supplier Invoices / Receipts 
   └── 💸 Scanned Product Costs
        └── 📈 Real-Time Price Variation Detection
             └── 🍳 Recipe Portion Cost & Margin Re-calculations
                  └── 🤖 AI Action Insights & Labor Optimizations
```

---

## Monorepo Architecture

This repository uses **Yarn Workspaces** for hoisting dependencies and **Turborepo** to coordinate compilation, caching, and execution scripts:

```
hospitality_saas/
├── package.json (Yarn workspaces declaration & resolutions)
├── tsconfig.json (Base TypeScript config)
├── turbo.json (Turborepo task pipelines)
├── .eslintrc.js / .prettierrc (Linting & formatting)
├── apps/
│   ├── web/ (Next.js 15 App Router web client)
│   └── mobile/ (React Native Expo App router client)
└── packages/
    ├── shared-types/ (TypeScript domain models)
    ├── validation/ (Shared Zod request/form validators)
    ├── constants/ (Alert thresholds & category keys)
    ├── utils/ (Margin, labor cost, and currency helper scripts)
    └── api-client/ (Axios client with bearer refresh interceptors)
```

---

## Tech Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Monorepo Engine** | Turborepo + Yarn Workspaces | Orchestrates builds and caches pipeline tasks. |
| **Web App** | Next.js 15 (React 19) + Tailwind CSS | Desktop portal for analytics, audits, and setups. |
| **Mobile App** | Expo SDK 51 + NativeWind v4 | On-the-floor camera uploads, alerts, and chat. |
| **State Management**| Zustand | Lightweight, hook-based authentication and UI stores. |
| **API Client** | Axios | Platform-agnostic REST connector to the NestJS backend. |
| **Validation** | Zod | End-to-end schemas sharing validation from client to API. |

---

## Shared Packages

1. **`shared-types`**:
   Unifies the data contract (User, Supplier, SuppliedProduct, Invoice, Recipe, StaffMember, StaffShift, OperationalIncident, AIInsight).
2. **`validation`**:
   Consolidates request checks (e.g. `LoginSchema`, `SupplierSchema`, `StaffShiftSchema`, `PriceDisputeSchema`), avoiding duplicate validation logic on web and mobile.
3. **`api-client`**:
   A base `ApiClient` instance executing interceptors to dynamically inject authorization tokens and handle `401 Unauthorized` token refreshing.
4. **`utils`**:
   Implements shared formatting and margin calculations (`formatCurrency`, `calculateRecipeMargin`, `calculateLaborRatio`).
5. **`constants`**:
   Stores thresholds (e.g. `LABOR_COST_LIMIT_PERCENTAGE = 30`, `COST_SPIKE_WARNING_THRESHOLD_PERCENTAGE = 5`) and UI badges settings.

---

## Applications

### 🖥️ Web App (`apps/web`)
* **Framework:** Next.js 15 (React 19) with App Router.
* **Layout:** Sidebar menu, user roles badges, and profile cards.
* **Incident Exception Dashboard:** Renders exceptions (price spikes, labor cost leakages) with active resolve handlers.
* **Siri Chatbot Agent:** Prompts chat queries directly to the RAG backend interface.

### 📱 Mobile App (`apps/mobile`)
* **Framework:** Expo SDK 51 with compatible React Native layouts.
* **Styling:** NativeWind v4 directives.
* **Siri voice trigger:** Features a prominent microphone icon simulating STT/TTS speech translation and querying the RAG chatbot database.

---

## Getting Started & CLI Commands

### 1. Prerequisites
Ensure you have **Node.js 20+** and **Yarn v1** installed globally on your machine.

### 2. Installation
To download and link workspace packages, run:
```bash
yarn install
```

### 3. Development
To start Next.js and Expo Metro bundler concurrently, run:
```bash
yarn dev
```

### 4. Build Compilation
To verify types and run production optimization compilations, run:
```bash
yarn build
```

---

## Operational Exceptions Tracker

The exceptions engine logs issues to `OperationalIncident` logs under categories:
* **Price Spikes:** Scanned invoice lines exceeding supplier contract agreements.
* **Labor Leakages:** shift labor costs exceeding target limits (e.g., > 30% of sales).
* **Waste Spikes:** High spillage/breakage quantities logged by staff.

---

## AI Siri-Style Chatbot Assistant

Both platforms connect voice/text questions to the backend RAG solver:
1. User asks: *"Did Gin cost increase?"* or *"Who did I buy Lime from?"*
2. Speech is translated via native OS Speech-to-Text (STT) into text.
3. Backend classifies the query:
   * **Analytical:** Formulates SQL dynamically and runs on Postgres tables.
   * **Semantic:** Vector-searches PDF contract rules in pgvector database.
4. Response text is returned and read aloud via native Text-to-Speech (TTS).
