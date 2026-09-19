# AT-ERP Documentation Index

Welcome to the centralized documentation hub for **AT-ERP** (AccountTech Enterprise Resource Planning for Educational & Training Institutions).

---

## 🏛️ Core Architecture & Domain Specifications

| Document | Description |
| :--- | :--- |
| [**Architecture & System Design**](file:///e:/laragon/www/ERP-NEW/docs/architecture.md) | High-level SPA architecture, runtime stack, component layout, services, and Edge Function controllers. |
| [**Database Schema & Migrations**](file:///e:/laragon/www/ERP-NEW/docs/database.md) | Supabase PostgreSQL schema, tables, active migrations, and Row-Level Security (RLS) policies. |
| [**Business & Accounting Rules**](file:///e:/laragon/www/ERP-NEW/docs/business-rules.md) | Domain business logic, GL double-entry constraints, AR/AP flows, and accounting period rules. |
| [**Standardized Chart of Accounts**](file:///e:/laragon/www/ERP-NEW/docs/chart-of-accounts.md) | Complete chart of accounts (1000–6000), account classes, normal balances, and financial statement mappings. |
| [**Role & Module Access Matrix**](file:///e:/laragon/www/ERP-NEW/docs/role-module-access.md) | RBAC permissions, role definitions, module tabs, and action rights mapped to `config/permissions.ts`. |
| [**UI/UX Design System**](file:///e:/laragon/www/ERP-NEW/docs/design-system.md) | Official Bento Grid SaaS design specifications, typography standards, color tokens, and table/card patterns. |

---

## 🛠️ Operations, Integration & Audit

| Document | Description |
| :--- | :--- |
| [**Supabase Cloud & Local Sync Manual**](file:///e:/laragon/www/ERP-NEW/docs/supabase-sync-guide.md) | Step-by-step procedures for syncing schema, migrations, and seed data between local Docker and Supabase Cloud. |
| [**Student Document Storage & Upload**](file:///e:/laragon/www/ERP-NEW/docs/student-document-upload.md) | Independent document upload architecture, service API, verification flows, and compliance metrics. |
| [**Forensic CPA & Systems Audit Report**](file:///e:/laragon/www/ERP-NEW/docs/system-audit-report.md) | Comprehensive audit report covering GL, period close, statutory deductions, inventory, and system integrity. |

---

## 🗺️ Roadmaps & Remediation Trackers

All active roadmaps and remediation plans are organized in the [`docs/roadmaps/`](file:///e:/laragon/www/ERP-NEW/docs/roadmaps/) directory:

| Roadmap | Status / Focus |
| :--- | :--- |
| [**AP, AR & Registrar Remediation**](file:///e:/laragon/www/ERP-NEW/docs/roadmaps/ap-ar-registrar-remediation.md) | Security hardening, maker-checker workflows, audit trails, and Edge Function standardization. |
| [**Inventory Accounting & Usability**](file:///e:/laragon/www/ERP-NEW/docs/roadmaps/inventory-remediation.md) | Warehouse operations usability, double-entry GL integration, and valuation rules. |
| [**Performance & Scalability Optimization**](file:///e:/laragon/www/ERP-NEW/docs/roadmaps/performance-optimization.md) | PostgreSQL indexing, server-side pagination, payload reduction, and startup preload optimization. |
| [**Academic & Hybrid Institution Upgrade**](file:///e:/laragon/www/ERP-NEW/docs/roadmaps/academic-upgrade-roadmap.md) | Multi-institution expansion supporting Training (TESDA), Academic, and Hybrid institutional modes. |
