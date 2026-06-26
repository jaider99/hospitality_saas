---
name: Quiet Hospitality
colors:
  surface: '#ffffff'
  surface-dim: '#e1dfda'
  surface-bright: '#fafaf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4f1'
  surface-container: '#f1f0ec'
  surface-container-high: '#edece8'
  surface-container-highest: '#e7e5e0'
  on-surface: '#151515'
  on-surface-variant: '#8c8c89'
  inverse-surface: '#1a1a1a'
  inverse-on-surface: '#f7f6f3'
  outline: '#a8a8a4'
  outline-variant: '#e2e1dd'
  primary: '#151515'
  on-primary: '#ffffff'
  primary-container: '#f1f1ee'
  on-primary-container: '#151515'
  inverse-primary: '#efede7'
  secondary: '#323230'
  on-secondary: '#ffffff'
  secondary-container: '#f1f1ee'
  on-secondary-container: '#151515'
  tertiary: '#8c8c89'
  on-tertiary: '#ffffff'
  tertiary-container: '#f1f0ec'
  on-tertiary-container: '#151515'
  error: '#b23a3a'
  on-error: '#ffffff'
  error-container: '#fceaea'
  on-error-container: '#7a2828'
  background: '#fafaf8'
  on-background: '#151515'
  warning: '#b07a1a'
  warning-container: '#fbf1dd'
  info: '#2f6bb0'
  info-container: '#e6eef8'
  accent: '#1f8f5c'
  accent-container: '#e6f4ec'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.12'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 26px
    fontWeight: '600'
    lineHeight: '1.15'
  headline-md:
    fontFamily: Sora
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.18'
  headline-sm:
    fontFamily: Sora
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.33'
  body-lg:
    fontFamily: Sora
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.43'
  body-sm:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.33'
  label-md:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.28'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.33'
    letterSpacing: 0.02em
  fintech-lg:
    fontFamily: DM Mono
    fontSize: 38px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  fintech-md:
    fontFamily: DM Mono
    fontSize: 22px
    fontWeight: '500'
    lineHeight: '1.18'
  fintech-sm:
    fontFamily: DM Mono
    fontSize: 15px
    fontWeight: '500'
    lineHeight: '1.47'
rounded:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px
  huge: 64px
---

# Quiet Hospitality Design System (DESIGN.md)

This specification defines the visual standards, UX behaviors, and UI patterns for both the **Next.js Web Client** and the **Expo React Native Mobile Client** monorepo of the Hospitality SaaS Platform, matching the client's design language.

---

## 🎨 1. Brand Identity & Visual Ethos

### Quiet Hospitality Approach
The platform acts as a high-end digital concierge for busy hospitality managers. Visuals must balance high-density information with premium, low-clutter aesthetics.
- **Tone:** Poised, clean, reliable, professional.
- **Aesthetic:** Minimalist corporate neobank, hairline dividers, pure white elevated containers on a soft off-white canvas.
- **Typography Philosophy:** Sora for displays and UI controls provides a modern sans feel; DM Mono for financial metrics and numeric data ensures clean alignment (tabular figures).

---

## 📱 2. Mobile UI Layouts & Components (`apps/mobile`)

The mobile client is designed mobile-first, ensuring high-contrast text and easily interactive layouts on single-tap gestures.

### 2.1 The Global Shell & Floating Navigation Bar
- **Base Canvas Background:** `#fafaf8` (bone canvas).
- **Sticky Floating Navigation Bar:**
  - Placed at the bottom of the screen with a wide pill shape (`rounded-full`).
  - Solid white background (`#ffffff`) with a very light ambient shadow.
  - **Center Quick-Add Action:** A prominent, larger black circular button (`#151515`) containing a white `+` icon positioned in the center, protruding slightly above the navigation bar line.
  - **Navigation Items:** Icons for *Home* (Home icon), *Analytics* (Graph trend line), *Uploads/Documents* (File icon), and *Invoices* (Receipt icon) evenly spaced.

### 2.2 Documents Screen UI (Mobile)
- **Top Header:** "Documents" in large bold Sora font (`26px`).
- **Search input:** A rounded search field (`rounded-xl` or `rounded-full`) with a soft background, containing a search icon and placeholder text `"Search documents, suppliers..."`.
- **Sub-header details:**
  - Status counts displayed below search (e.g., `• 1 processing`, `• 9 completed`, `• 0 flagged`) in subtle pill shapes.
  - Tab controls for filtering: `"All Docs"`, `"Processing"`, `"Completed"`, `"Flagged"`. The active tab is a solid dark pill (`#151515`) with white text; inactive tabs are white or transparent with dark text.
- **Document List Items (Cards):**
  - Renders as white cards with rounded corners (`rounded-xl` or `14px` radius).
  - Left icon indicating document type: e.g., receipt icon for invoices (`bg-[#e6f4ec]` container with green receipt icon), truck icon for delivery notes (`bg-[#f5f4f1]` container with dark truck icon).
  - Center details: supplier name, document ID/date.
  - Right details: total value in bold.
  - Active states (e.g., "AI extracting...") use a spinning refresh indicator next to a gray label `"Al extracting..."`.

### 2.3 Document Review Center
- **Layout:** A task list containing anomalies or missing mappings.
- **Top Metrics Strip:** Displays summaries in card blocks (e.g., `"28 Open"`, `"1 Critical"`, `"23 AI review"`, `"2 Prices"`).
- **Review Cards:**
  - Elevated white panels with a left color border indicator or warning badge.
  - **Price Anomaly Card:** Displays `Price alert CRITICAL` in red, description of the item (e.g. "Limoncello Rossi D'asiago quantity is unusually high..."), timestamp, and action buttons (`"Open"`, checkmark, cross mark).
  - **Missing Match Card:** Displays `Product match HIGH`, the text description (e.g., "GIN XORIGUER 0.70"), timestamp, and action buttons (`"Match"`, checkmark, cross mark).

### 2.4 Extracted Products Table (Detail / Audit View)
- Displays extracted line items in a clean, vertical table-like format.
- Table headers: `Item`, `Qty`, `Price`, `Total` in muted gray typography.
- Alternating row details or structured padding (`py-3`) using Sora Medium for text.
- **Action Footer:** A sticky bottom sheet containing secondary actions: `"Edit"` (left, dark background) and `"Delete"` (right, red text link with trash icon).

---

## 🖥️ 3. Web UI Layouts & Components (`apps/web`)

The Next.js 15 Web Client handles large-screen audits, detailed analytics grids, and advanced configurations.

### 3.1 Layout Grid & Container Bounds
- **12-Column Layout:** Centered structure with a maximum width of `1440px`.
- **Gutter:** `24px` spacing between layout components.
- **Navigation:** Left sidebar in Dark Charcoal (`#151515`) or top navigation with clean text links.

### 3.2 Metrics Ribbon & Overview (Dashboard)
- Spans the top of `/dashboard` with four key KPI columns:
  1. **Total Spend** (Currency formatted).
  2. **Actual Margin vs. Target Margin** (With color indicators: Green for stable, Red for drops).
  3. **Labor Ratio** (Flags red if percentage > 30%).
  4. **Open Incidents** (Count link to Incident center).
- Cards use white background, Level 1 shadow, and a subtle border (`#e2e1dd`).

### 3.3 Relational Spends & Invoices Workspace
- **Layout:** Two-column split-view.
  - **Left column (1/3 width):** Search, filters, and list of uploaded invoices.
  - **Right column (2/3 width):** Detailed preview of the selected invoice.
- Contains the duplicate detection alerts in warning/error colors (`#fceaea` soft pink container with red warning icon and text).
- **Line Item Catalog Matching:** Side-by-side view matching raw OCR lines to SuppliedProduct entries, with dropdown matches and a confirmation checkmark.

### 3.4 Recipes Control Board
- Displays ingredient list tables with portion cost calculations.
- Highlights items where supplier price spikes have damaged margins.
- A sliding drawer panel for editing ingredients in real time.

### 3.5 Siri RAG Chatbot Panel
- Prominent input field at the bottom of the overview dashboard or in a collapsable side drawer.
- Features standard quick-suggestion chips (e.g., *"What did I spend on beverage suppliers last week?"*, *"Who do I contact for food safety audits?"*).
- Displays conversational response Bubbles: User bubble is aligned right in soft gray; AI response is aligned left in pure white with dark charcoal text.

---

## ⚠️ 4. Color, Warning, and State Mappings

| UI Element / State | Background Color | Text Color | Border Color | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Action** | `#151515` | `#ffffff` | N/A | Main CTA buttons, active state highlights. |
| **Secondary Action** | `#ffffff` | `#151515` | `#e2e1dd` | Secondary buttons, cancel buttons. |
| **Success / Confirmed** | `#e6f4ec` (10% opacity) | `#1f8f5c` | N/A | Checked items, completed bills, matched ingredients. |
| **Duplicate / Error** | `#fceaea` | `#b23a3a` | N/A | Duplicate invoice warning, critical incidents. |
| **Price Alert / Warning** | `#fbf1dd` | `#b07a1a` | N/A | Anomaly price spikes, margin drops, labor ratio warnings. |
| **Default Borders** | N/A | N/A | `#e2e1dd` | Table dividers, card separators. |
