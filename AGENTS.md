# Repository Guidelines

## Project Overview
AT-ERP is a React 18 + TypeScript + Vite ERP for educational and training institutions. It covers tenant administration, RBAC, accounting, accounts receivable, accounts payable, inventory, training operations, payroll, subscriptions, audit logs, backup/restore, and student/trainer portals.

The active application entry path is `index.tsx` -> `App.tsx`. `App.tsx` owns authentication flow, tenant selection, tab routing, global state hydration, cross-module handlers, notification plumbing, and view orchestration.

## Project Structure
- `App.tsx` is the main controller/router for the SPA. Add new screens by importing a view, wiring a tab key, adding permissions where needed, and rendering the view in the main content switch.
- `views/` contains feature screens. View files follow the `[Feature]View.tsx` pattern and receive data plus callbacks from `App.tsx`.
- `components/` contains shared UI helpers such as notifications, pagination, modal portal, journal form, font scaling, empty states, and TESDA learner form entry.
- `services/` contains domain logic and data access. `DataServiceFactory.ts` currently returns `SupabaseDataService`.
- `services/IDataService.ts` is the persistence contract. Keep it aligned with `SupabaseDataService.ts` when adding entities.
- `types.ts` is the central model catalog for entities, statuses, roles, permissions, payroll/tax types, and domain enums.
- `config/app.ts` reads Supabase environment config and refuses unsafe local/hosted mismatches.
- `config/permissions.ts` defines module access, role groups, default tabs, and action permissions.
- `accountingService.ts` contains ledger summaries, trial balance, balance sheet, income statement, account balances, and closing-entry helpers.
- `db.ts` holds empty initial arrays and a chart of accounts template for fallback/mock-style initialization.
- `supabase/migrations/` contains database changes. Some files are disabled with `.disabled`; do not assume disabled migrations have been applied.
- `supabase/functions/` contains service-role Edge Functions for privileged writes.
- `src/` contains duplicated inventory/backup service/view files plus `src/index.css`; root-level `views/` and `services/` are the active app paths unless imported otherwise.

## Commands
- `npm run dev` starts the Vite dev server.
- `npm run build` builds production assets into `dist/`.
- `npm run preview` serves the production build locally.
- `npm test` runs Vitest.
- `npm test -- tests/InvoicesView.test.tsx --run` runs one test file once.
- `npm run test:watch` runs Vitest in watch mode.

## Coding Conventions
- Use React function components with TypeScript and the `react-jsx` transform.
- Keep feature screens in `views/` and shared widgets in `components/`.
- Prefer models from `types.ts` instead of duplicating ad hoc shapes.
- Keep domain calculations in services rather than embedding them deeply in JSX.
- Keep data persistence behind `IDataService` and `DataServiceFactory`.
- Preserve the existing camelCase TypeScript model style and snake_case Supabase table/column style. `SupabaseDataService` performs conversion.
- Use the `@/*` alias only where it improves clarity; existing root-relative imports are common.
- No ESLint or Prettier config is present. Match nearby formatting.

## Supabase Notes
- Runtime config comes from `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_ENV`.
- `SupabaseDataService` primarily uses Supabase REST endpoints and selected RPC calls.
- Privileged writes for users, organizations, payments, and feedback tickets use Edge Functions under `supabase/functions/`.
- Edge Functions expect `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and, where JWT validation is needed, `AT_ERP_JWT_SECRET`.
- Soft-delete fields are common: `is_deleted`, `deleted_at`, and `deleted_by`.
- Many screens filter by `orgId`; keep tenant isolation explicit in new queries and handlers.

## Testing Guidance
- Existing tests use Vitest and React Testing Library.
- Test files live in `tests/`.
- Current coverage includes invoice terms, billing computation, student documents, AR view behavior, and invoice view behavior.
- When touching a view, prefer focused tests around user-visible behavior and mocked service calls.
- When touching services, prefer deterministic unit tests for calculations and state transitions.

## Important Business Constraints
- Posted or finalized accounting documents should not be casually mutated. Invoice and journal handlers contain guards for posted/voided states.
- Journal entries must balance debit and credit totals before posting.
- Tenant-specific data should always be scoped by `orgId`.
- Student and trainer users must link to the corresponding student/trainer record.
- Sponsor, enrollment, assessment, invoice, payment, and GL records are tightly coupled; update related balances/statuses together.
- Inventory adjustments can generate GL entries and should preserve item/location/level consistency.
- Period closing supports AP, AR, GL, soft close, hard close, and lock states.

## Documentation
- `architecture.md` describes app structure, routing/controllers, services, models, views, and runtime flow.
- `database.md` describes schema, migrations, functions, relationships, and persistence behavior.
- `business-rules.md` captures implemented workflows and state rules.
