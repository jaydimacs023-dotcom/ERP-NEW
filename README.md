# AT-ERP (AccountTech Enterprise Resource Planning)

A modern, multi-tenant enterprise ERP platform engineered specifically for educational and vocational training institutions (supporting TESDA training programs, academic schools, and hybrid models). Built with React 18, TypeScript, Vite, and Supabase PostgreSQL.

---

## 🌟 Core Modules & Capabilities

- **Financial Core & General Ledger**: Double-entry journal entries, real-time trial balance, income statement, balance sheet, accounting period closing controls (`OPEN`, `SOFT_CLOSE`, `HARD_CLOSE`, `LOCKED`), and multi-currency support.
- **Accounts Receivable (AR)**: Student & corporate sponsor billing, course fee schedules, automated invoice generation, payment applications, bank deposits, and automated aging reports.
- **Accounts Payable (AP)**: Vendor management, purchase orders, goods receipts, 3-way matching, bill processing, check printing, and disbursement vouchers.
- **Inventory & Warehouse Operations**: Multi-location warehouse tracking, stock levels, adjustments, reorder points, valuation, and automatic GL journal entry integration.
- **Training & Registrar Operations**: Qualifications/courses, batch management, student admissions, enrollment workflows, attendance tracking, and assessment registrations.
- **Student & Trainer Portals**: Self-service student portal (profile, independent document uploads for TOR/Birth Certificate, grades, statement of accounts) and trainer schedule management.
- **Payroll & Statutory Compliance**: Philippine statutory deductions (BIR, SSS, PhilHealth, Pag-IBIG), 13th-month pay, attendance, and leave tracking.
- **Multi-Tenant SaaS Administration**: Tenant provisioning, institution modes (`TRAINING`, `ACADEMIC`, `HYBRID`), subscription management, role-based access control (RBAC), and forensic audit logs.

---

## 🛠️ Technology Stack

- **Frontend**: React 18 (SPA), TypeScript, Vite, Tailwind CSS, Lucide React, Recharts
- **Persistence & Backend**: Supabase PostgreSQL, Supabase Edge Functions (Deno/TypeScript)
- **Security & Authorization**: Supabase Auth (GoTrue) sessions, 100% PostgreSQL Row-Level Security (RLS) across all tenant tables, and role/permission matrix
- **Testing**: Vitest, React Testing Library, jsdom

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Docker Desktop (for local Supabase development)
- Supabase CLI (`npx supabase`)

### Installation & Environment Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repository-url>
   cd ERP-NEW
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` for local development or `.env.production.local` for cloud staging:
   ```env
   VITE_APP_ENV=local
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   VITE_API_URL=http://127.0.0.1:54321
   VITE_STORAGE_BUCKET=attachments
   ```

3. **Start Local Supabase (Docker)**:
   ```bash
   npx supabase start
   ```

4. **Start Vite Dev Server**:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Production Build

- **Run all tests**:
  ```bash
  npm test
  ```
- **Run specific test file**:
  ```bash
  npm test -- tests/AuthService.test.ts --run
  ```
- **Build production bundle**:
  ```bash
  npm run build
  ```
- **Build for Cloud Production**:
  ```bash
  npm run build -- --mode production
  ```

---

## 📚 Documentation

All comprehensive project guides, architecture specifications, database schemas, and roadmaps are consolidated in the [**`docs/`**](file:///e:/laragon/www/ERP-NEW/docs/README.md) directory:

- [**Documentation Hub & Index**](file:///e:/laragon/www/ERP-NEW/docs/README.md)
- [System Architecture](file:///e:/laragon/www/ERP-NEW/docs/architecture.md)
- [Database Schema & Migrations](file:///e:/laragon/www/ERP-NEW/docs/database.md)
- [Business & Accounting Rules](file:///e:/laragon/www/ERP-NEW/docs/business-rules.md)
- [Standardized Chart of Accounts](file:///e:/laragon/www/ERP-NEW/docs/chart-of-accounts.md)
- [Role & Module Access Matrix](file:///e:/laragon/www/ERP-NEW/docs/role-module-access.md)
- [UI/UX Design System](file:///e:/laragon/www/ERP-NEW/docs/design-system.md)
- [Supabase Sync & Migration Manual](file:///e:/laragon/www/ERP-NEW/docs/supabase-sync-guide.md)
- [Student Document Upload Architecture](file:///e:/laragon/www/ERP-NEW/docs/student-document-upload.md)
- [Forensic System Audit Report](file:///e:/laragon/www/ERP-NEW/docs/system-audit-report.md)
- [Project Roadmaps & Trackers](file:///e:/laragon/www/ERP-NEW/docs/roadmaps/)
