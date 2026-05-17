# TYPOGRAPHY_SYSTEM_GLOBAL_REFACTOR.md

# Global Typography Refactor System

## Objective

Apply a clean, premium ERP/SaaS typography system globally across the entire application.

The typography style should resemble:

* modern accounting systems
* enterprise dashboards
* ERP systems
* clean financial software
* compact SaaS UI
* professional ledger/report interfaces

This refactor is STRICTLY VISUAL ONLY.

---

# STRICT NON-NEGOTIABLE RULES

## DO NOT TOUCH

The following must NEVER be modified:

* business logic
* functions
* API calls
* database queries
* calculations
* state management
* routes
* authentication
* validation
* component behavior
* service layer
* hooks
* stores
* reducers
* backend logic
* SQL
* migrations
* controllers
* repositories
* event handlers

---

# ALLOWED CHANGES ONLY

You may ONLY modify:

* font family
* font sizes
* font weights
* line heights
* letter spacing
* typography spacing
* table text styling
* form text styling
* button text styling
* typography consistency
* visual readability

---

# TYPOGRAPHY DESIGN TARGET

The system should visually feel:

* clean
* enterprise-grade
* accounting-focused
* premium SaaS
* modern ERP
* compact
* readable
* financial-system ready

Typography should resemble systems like:

* Acumatica
* QuickBooks Online
* Xero
* Oracle NetSuite
* modern banking dashboards
* premium admin templates

---

# PRIMARY FONT

Use:

```css
Inter
```

Fallback stack:

```css
"Inter", "Open Sans", "Segoe UI", Arial, sans-serif
```

---

# STEP 1 — IMPORT FONT

## If using Vite / React

Modify:

```txt
index.html
```

Add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

---

## If using Laravel Blade

Modify:

```txt
resources/views/layouts/app.blade.php
```

or:

```txt
resources/views/app.blade.php
```

Add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

---

# STEP 2 — GLOBAL CSS TYPOGRAPHY SYSTEM

Locate the main global stylesheet.

Possible files:

```txt
src/index.css
src/App.css
src/globals.css
src/styles/global.css
resources/css/app.css
resources/css/global.css
```

Add the following:

```css
:root {
  --font-sans: "Inter", "Open Sans", "Segoe UI", Arial, sans-serif;

  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-muted: #64748b;

  --font-page-title: 22px;
  --font-section-title: 15px;
  --font-card-value: 18px;

  --font-body: 14px;
  --font-table: 13px;
  --font-small: 12px;

  --line-tight: 1.2;
  --line-normal: 1.45;
  --line-relaxed: 1.6;
}

html,
body {
  font-family: var(--font-sans);
  font-size: var(--font-body);
  font-weight: 400;
  line-height: var(--line-normal);
  color: var(--text-primary);
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  font-family: inherit;
  box-sizing: border-box;
}
```

---

# STEP 3 — PAGE TITLES

Apply globally:

```css
h1,
.page-title,
.module-title {
  font-size: var(--font-page-title);
  font-weight: 700;
  line-height: var(--line-tight);
  letter-spacing: -0.025em;
  color: var(--text-primary);
}

h2,
.section-title,
.card-title,
.panel-title {
  font-size: var(--font-section-title);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.015em;
  color: var(--text-primary);
}
```

---

# STEP 4 — SUBTITLES

```css
.page-subtitle,
.module-subtitle,
.text-subtitle {
  font-size: 13px;
  font-weight: 400;
  font-style: italic;
  line-height: 1.4;
  color: var(--text-muted);
}
```

---

# STEP 5 — SUMMARY CARDS

```css
.card-label,
.summary-label,
.metric-label {
  font-size: var(--font-small);
  font-weight: 500;
  color: #475569;
  line-height: 1.3;
}

.card-value,
.summary-value,
.metric-value {
  font-size: var(--font-card-value);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}
```

---

# STEP 6 — FORM TYPOGRAPHY

```css
input,
select,
textarea,
button {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
}

input,
select,
textarea {
  font-weight: 400;
  color: var(--text-primary);
}

input::placeholder,
textarea::placeholder {
  color: #94a3b8;
  font-size: 12px;
}

label,
.form-label,
.filter-label {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

button,
.btn {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
```

---

# STEP 7 — TABLE TYPOGRAPHY

Apply to ALL tables globally.

```css
table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: var(--font-table);
  color: var(--text-primary);
}

thead th {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

tbody td {
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  color: #1e293b;
}

.table-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.table-footer,
.pagination-info {
  font-size: 12px;
  color: #64748b;
}
```

---

# STEP 8 — ACCOUNTING AMOUNTS

```css
.amount,
.currency,
.money {
  font-weight: 700;
  letter-spacing: -0.01em;
}

.amount-positive,
.debit-amount,
.text-success {
  font-weight: 700;
  color: #00a65a;
}

.amount-negative,
.credit-amount,
.text-danger {
  font-weight: 700;
  color: #ef4444;
}

.running-balance,
.balance-amount {
  font-weight: 600;
  color: var(--text-primary);
}
```

---

# STEP 9 — SIDEBAR TYPOGRAPHY

```css
.sidebar-item,
.sidebar-link {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
}

.sidebar-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}
```

---

# STEP 10 — NAVBAR TYPOGRAPHY

```css
.navbar-title,
.topbar-title {
  font-size: 14px;
  font-weight: 600;
}

.navbar-subtitle {
  font-size: 12px;
  color: #64748b;
}
```

---

# STEP 11 — BADGES / STATUS

```css
.badge,
.status-badge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
```

---

# STEP 12 — TAILWIND CONFIGURATION

If using Tailwind CSS:

Modify:

```txt
tailwind.config.js
```

Add:

```js
theme: {
  extend: {
    fontFamily: {
      sans: ["Inter", "Open Sans", "Segoe UI", "Arial", "sans-serif"],
    },
  },
}
```

Then apply globally:

```css
body {
  @apply font-sans;
}
```

or:

```tsx
className="font-sans"
```

at the root layout.

---

# STEP 13 — REMOVE INCONSISTENT TYPOGRAPHY

Search and normalize:

## Replace overly large titles

Avoid:

```tsx
text-4xl
text-3xl
font-black
font-extrabold
```

Prefer:

```tsx
text-[22px] font-bold
text-[15px] font-bold
```

---

## Replace inconsistent table sizes

Avoid:

```tsx
text-xs
text-sm
text-lg
```

Prefer:

```tsx
text-[12px]
text-[13px]
```

---

# STEP 14 — PRIORITY MODULES

Verify typography consistency in:

* Dashboard
* Customer Ledger
* AR
* AP
* Invoices
* Payments
* Credit Memo
* Debit Memo
* Write-Off
* Reclassification
* General Ledger
* Reports
* Settings
* User Management

---

# STEP 15 — FINAL VISUAL CHECKLIST

The final UI should feel:

✅ clean
✅ compact
✅ accounting-focused
✅ professional
✅ readable
✅ enterprise-grade
✅ premium SaaS
✅ modern ERP

---

# FINAL AGENT INSTRUCTION

Refactor the entire application typography system globally using this specification.

Priority:

1. global CSS
2. Tailwind configuration
3. reusable typography classes

Avoid modifying individual components unless typography is hardcoded.

DO NOT TOUCH:

* logic
* backend
* APIs
* database
* services
* calculations
* business rules
* functionality

This task is STRICTLY a global visual typography refactor only.
