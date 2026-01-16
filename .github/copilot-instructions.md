# Copilot Instructions for AT-ERP

## Project Overview
**AT-ERP** is a comprehensive React + TypeScript ERP system for educational institutions, combining training management, student lifecycle, payroll, accounting, and financial operations into a single UI. The system uses Vite for bundling and supports both mock data (development) and Supabase (production).

## Architecture Patterns

### Multi-View Tab System (App.tsx)
The application uses a single-page architecture with tab-based navigation. `App.tsx` manages all state and orchestrates data through:
- **Master Data Views**: Students, Qualifications, Trainers, Batches, Locations, Sponsors, Vendors, Employees
- **Financial Views**: Chart of Accounts, Ledger, Reports, Journal Entries, AP/AR, Purchase Orders, Banking
- **Admin Views**: Users Management, Tenant Management, Branding, Subscriptions, Audit Trail
- State is lifted to `App.tsx` and passed down via props to views (avoid Redux for now)

### Service Layer Architecture
**Data abstraction via factory pattern** (see `services/DataServiceFactory.ts`):
- `IDataService`: Abstract interface defining CRUD contract
- `MockDataService`: Development/demo data (hardcoded objects)
- `SupabaseDataService`: Cloud data fetching from Supabase
- **Runtime Override**: `localStorage.getItem('AT_ERP_DATA_SOURCE')` switches between 'MOCK' and 'CLOUD' without rebuild
- See `config/app.ts` for logic: missing Supabase creds → force Mock; otherwise respect override

### Accounting Logic Encapsulation
`AccountingService.ts` contains static utility methods for double-entry accounting:
- **Balance Calculation**: Respects normal balances per `AccountClass` (Assets/Expenses = Dr-Cr; Liabilities/Equity/Revenue = Cr-Dr)
- **Reference Generation**: Creates sequential document IDs (e.g., `SI-2024-00001`)
- **Ledger Summaries**: Aggregates journal lines by account, computes debit/credit/balance
- Always use these methods when manipulating account balances or journal lines

## Key Types & Enums

Located in `types.ts`:
- **AccountClass**: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE (drives balance calculations)
- **BatchStatus**: DRAFT, OPEN_FOR_ENROLLMENT, ON_GOING, COMPLETED (immutable progression)
- **PurchaseOrderStatus**: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, FULLY_BILLED, CLOSED
- **SubscriptionStatus**: ACTIVE, TRIAL, SUSPENDED, EXPIRED, PENDING
- **BaseEntity**: Every entity has optional `isDeleted`, `deletedAt`, `deletedBy` (soft delete pattern)

## Development Workflows

### Build & Run
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (usually http://localhost:5173)
npm run build        # Production build output to dist/
npm run preview      # Preview production build locally
```

### Environment Setup
- `.env.local` controls Supabase credentials: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- No credentials → automatically uses MockDataService
- To switch data source at runtime in browser: `localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK')` or `'CLOUD'`

### Dependencies
- **React 19** + **TypeScript 5.8**: Functional components with strict typing
- **Vite 7**: Bundler and dev server
- **Recharts**: Charting library for Dashboard and Reports views
- **Lucide React**: Icon library used throughout UI
- No testing framework configured yet

## Code Patterns & Conventions

### React Component Structure
- **Functional components only** with `React.FC<Props>` typing
- Props drilling from `App.tsx` to views; each view receives data slices it needs
- Example: `Dashboard` receives `{ summaries, currency, lines, accounts }`
- Views are stateless (all state in App.tsx); mutations happen via App callbacks

### Type Safety
- Never use `any` types except for Vite `import.meta` workarounds (see `config/app.ts`)
- All entities extend `BaseEntity` interface for consistency
- Status fields use string unions (e.g., `SubscriptionStatus = 'ACTIVE' | 'TRIAL' | ...`)

### Configuration Pattern
`config/app.ts` exports a single `config` object with environment checks:
```typescript
export const config = {
  mode, isDev, isProd,
  useMockData,  // Boolean switch
  supabaseUrl, supabaseKey, hasSupabaseCreds
}
```
Import this in services to make data-source decisions.

### View Naming
Files in `views/` follow pattern: `[Feature][View].tsx` (e.g., `StudentsView.tsx`, `PurchaseOrdersView.tsx`)
All views accept their data as props and are called from App.tsx tab routing.

## Integration Points

### Supabase
- Implemented in `SupabaseDataService.ts`
- Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env variables
- Currently fetches from tables matching entity names (e.g., `organizations`, `users`, `journal_entries`)
- CRUD endpoints to be expanded

### Currency & Multi-Tenancy
- Each `Organization` has a `currency` field (stored in Supabase or mock data)
- `currentOrgId` tracks active tenant; all data should be filtered by `orgId`
- Views pass `currency` from organization to format financial values

### Audit Trail
- `AuditLog` entity tracks user actions (stored in `auditLogs` view)
- Create audit entries whenever master data is modified (pattern not yet fully implemented)

## Common Tasks

### Adding a New Master Data View
1. Create new entity type in `types.ts` (extend `BaseEntity`)
2. Add state in `App.tsx`: `const [items, setItems] = useState<MyEntity[]>([])`
3. Create `views/MyEntityView.tsx` accepting `{ items, onAdd, onUpdate, onDelete }`
4. Wire tab routing in App.tsx sidebar and main view selector
5. Add fetch logic to `IDataService` and both implementations

### Displaying Financial Metrics
1. Use `AccountingService` methods to compute balances
2. Pass `TransactionSummary[]` to views that need summaries (Dashboard, Ledger, Reports)
3. Format currency using the pattern in Dashboard: `formatCurrency()` with locale-aware rounding

### Switching Data Sources
- In browser dev tools: `localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK')` then reload
- Or rebuild with/without Supabase env vars set

## Known Limitations & Future Work
- No real-time updates (polling or websockets not implemented)
- Mock data is static; edits don't persist across page reloads
- Audit trail creation incomplete in workflows
- No batch operations or bulk import
- Login view exists but authentication flow incomplete
