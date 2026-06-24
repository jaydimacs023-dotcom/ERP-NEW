# Architecture

## Summary
AT-ERP is a single-page React application built with Vite and TypeScript. The frontend owns most workflow orchestration, while Supabase provides persistent storage, REST access, RPC helpers, and Edge Functions for privileged writes.

The system is organized around a central application controller, typed domain models, service classes, and feature views.

## Runtime Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, lucide-react, Recharts.
- Tests: Vitest, jsdom, React Testing Library.
- Persistence: Supabase Postgres through REST, RPC, and Edge Functions.
- Auth/session: custom `AuthService`, `JWTService`, and `TokenManager`, backed by rows in the `users` table and JWTs stored client-side.

## Application Entry
- `index.html` loads the Vite bundle.
- `index.tsx` mounts React.
- `App.tsx` is the main SPA controller. It manages auth, tenant context, loaded records, tab navigation, role-based sidebar rendering, cross-module handlers, and view composition.

## Routes
There is no React Router package. Routing is implemented as tab state in `App.tsx`.

Important route groups:
- Public/auth: welcome, login, password reset.
- Portals: student portal, trainer portal, profile.
- Finance: dashboard, general ledger, reports, banking, checks, AR, invoices, payments, deposits, AP, payables, purchase orders, goods receipt, payroll, periods.
- Training operations: students, trainers, qualifications, batches, enrollments, assessments, schedules, locations, alumni reports.
- Masters: sponsors, vendors, non-stock items, fixed assets, course fees, customers.
- Inventory: inventory dashboard, warehouse locations, stock items, stock levels, stock adjustments, reorder points, transactions, analytics.
- Administration: branding, subscriptions, payment history, users, audit trail, maintenance, backup/restore, tenant management, schema manual, payment monitoring, feedback.

`config/permissions.ts` controls which tabs appear per role and which tab each role lands on after login.

## Controllers
The project does not use backend-style controller classes for most features. Controller behavior is split across:
- `App.tsx`: application-level controller for route changes, state, create/update/delete handlers, posting handlers, tenant selection, and notifications.
- View components in `views/`: local UI controllers for forms, filtering, pagination, validation, and screen-specific actions.
- Service classes in `services/`: domain controllers for calculations, persistence, audit, backup/restore, documents, payroll, billing, recognition, matching, and inventory GL.
- Supabase Edge Functions in `supabase/functions/`: backend controllers for privileged write operations.

Edge Function controllers:
- `organizations-write`: create, update, and delete organizations. Creation/deletion require `SYSTEM_ADMIN`; updates allow `SYSTEM_ADMIN` or same-org `ADMIN`.
- `users-write`: create users with role normalization, org authorization, and student/trainer link validation.
- `payments-write`: create payments and payment applications using service-role access and RPC payment numbering.
- `feedback-tickets`: create, update, and list support/feedback tickets with system-admin and org-scoped behavior.

## Models
`types.ts` is the central model file. It defines:
- Tenant/admin models: `Organization`, `User`, permissions, subscription status, plan type, institution type.
- Training models: `Student`, `Trainer`, `Qualification`, `Batch`, `TrainerSchedule`, `Location`, `Enrollment`, `AssessmentRegistration`, `AlumniEmploymentReport`.
- AR models: `CourseFee`, `Invoice`, `InvoiceLine`, `Payment`, `PaymentApplication`, `BankDeposit`, SOA/ledger supporting types.
- AP/procurement models: `Vendor`, `Bill`, `Payable`, `PurchaseOrder`, `GoodsReceipt`, `CheckVoucher`, ATC and withholding types.
- GL/accounting models: `ChartOfAccount`, `JournalEntry`, `JournalLine`, `AccountingPeriod`, `Budget`, `ExchangeRate`.
- Inventory models: `WarehouseLocation`, `StockItem`, `InventoryLevel`, `InventoryTransaction`, `StockAdjustment`, `ReorderPoint`.
- Payroll/tax models: `Employee`, `PayrollRun`, `PayrollLine`, tax tables, government contribution tables, attendance, leave, 13th month, separation pay, BIR forms.
- Operational models: `AuditLog`, `FeedbackTicket`, backup structures, revenue recognition schedules and entries.

## Services
Primary service boundary:
- `services/IDataService.ts` defines all persistence operations.
- `services/DataServiceFactory.ts` returns `SupabaseDataService`.
- `services/SupabaseDataService.ts` implements REST/RPC/Edge Function persistence, snake/camel conversion, schema filtering, soft delete, archive/restore, page fetching, usage checks, and entity-specific CRUD.

Domain services:
- `accountingService.ts`: balances, summaries, trial balance, income statement, balance sheet, cash flow, and closing entries.
- `BillingComputationService.ts`: enrollment/course-fee invoice computation, sponsored batch billing limits, billable/free enrollment classification.
- `InventoryGLService.ts`: GL journal creation for inventory transactions and adjustments.
- `InventoryReportingService.ts`: stock valuation, movement, turnover, and aging/reporting helpers.
- `ThreeWayMatchingService.ts`: PO, goods receipt, and invoice/payable matching with discrepancy classification.
- `RevenueRecognitionService.ts`: schedule calculations and recognition entries.
- `PayrollCalculationService.ts`, `ContributionService.ts`, `TaxBracketService.ts`, `TimeAttendanceService.ts`, `LeaveManagementService.ts`, `BIRReportService.ts`: payroll, tax, attendance, leave, and compliance calculations.
- `StudentDocumentService.ts`: required document normalization, compliance percentage, profile photo, TOR, birth certificate, and application-form handling.
- `BackupRestoreService.ts`: export/import package structure, checksums, organization filtering, and backup filenames.
- `AuditService.ts`: audit event construction, change detection, and callback integration.
- `AuthService.ts`, `PasswordService.ts`, `JWTService.ts`, `TokenManager.ts`, `PasswordResetService.ts`, `EmailVerificationService.ts`: authentication and account recovery.

## Views
Each view is a feature screen that receives data and callbacks from `App.tsx`.

Major view areas:
- Finance and GL: `Dashboard`, `Ledger`, `Reports`, `ChartOfAccounts`, `PeriodClosingView`, `BudgetView`, `RevenueRecognitionView`.
- AR: `ARView`, `InvoicesView`, `PaymentsView`, `BankDepositsView`, `SOAView`, `ARAgingReportView`, `ARCollectionReportView`, `ARCustomerLedgerView`, credit/debit memo, write-off, reclassification, collection receipt, calendar/tasks.
- AP/procurement: `APView`, `PayablesView`, `PurchaseOrdersView`, `GoodsReceiptView`, `CheckPrintingView`, `CheckRegisterView`, `MatchingDashboard`.
- Training: `StudentsView`, `TrainersView`, `QualificationsView`, `BatchesView`, `EnrollmentsView`, `AssessmentRegistrationsView`, `SchedulesView`, `LocationsView`, `AlumniEmploymentView`.
- Masters: `SponsorsView`, `VendorsView`, `ItemsView`, `CourseFeesView`, `CustomerMasterListView`, `AssetsView`, `EmployeesView`.
- Inventory: `InventoryView`, `WarehouseLocationsView`, `StockItemsView`, `StockAdjustmentsView`, `ReorderView`, `InventoryTransactionsView`, `AdvancedInventoryReports`.
- Admin/system: `UsersManagementView`, `AuditTrail`, `BrandingView`, `SubscriptionView`, `TenantManagementView`, `PaymentHistoryView`, `PaymentMonitoringView`, `BackupRestoreView`, `MaintenanceView`, `SchemaManualView`, `FeedbackManagementView`.
- Portals/auth: `WelcomeView`, `LoginView`, `PasswordResetView`, `StudentPortalView`, `TrainerPortalView`, `UserProfileView`.

## Data Flow
1. The app starts and reads Supabase config from `config/app.ts`.
2. `App.tsx` resolves authentication and current user/org state.
3. `DataServiceFactory.getService()` returns a singleton `SupabaseDataService`.
4. `getInitialData()` loads tenant, master, finance, AR/AP, inventory, payroll, and operational records.
5. `App.tsx` normalizes selected legacy statuses and links related records where needed.
6. Views receive filtered, org-scoped data and callback handlers.
7. Handlers call `SupabaseDataService` or domain services, then update React state and send notifications.
8. Privileged writes call Supabase Edge Functions, while standard reads/writes use REST and selected RPC functions.

## State And Tenant Isolation
Most entities include `orgId`. `App.tsx` filters visible data by `currentOrgId` before passing it to views. Role and tenant checks exist in both frontend permissions and selected Edge Functions.

System administrators operate across tenants. Organization admins and normal users operate within their current organization.

## Current Architectural Caveats
- Route/controller logic is centralized in a very large `App.tsx`.
- Some database migrations are disabled, so the SQL dump, active migrations, and deployed database may differ.
- `MockDataService` exists, but configuration currently favors `SupabaseDataService`.
- The `src/` directory contains duplicates of some root service/view files; root paths are the active convention unless imports say otherwise.
