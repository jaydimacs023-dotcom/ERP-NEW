# AT-ERP PERFORMANCE OPTIMIZATION TODO

## Objective

Optimize AT-ERP React + Supabase architecture to reduce:

* Supabase Cloud compute/RAM usage
* large payload transfers
* browser memory usage
* dashboard lag
* full-table scans
* React rendering overhead

Goals:

* scalable SaaS-ready architecture
* production-safe optimizations
* server-side pagination
* optimized dashboard queries
* indexed multi-tenant queries
* reduced startup preload

---

# PHASE 1 — DATABASE INDEXING (HIGH PRIORITY)

## Goal

Reduce sequential scans and improve filtering speed.

## Tasks

### Users / Authentication

* [x] Add `idx_users_org_id`
* [x] Add `idx_users_auth_uid`

### Students / Trainers / Sponsors / Vendors

* [x] Add `idx_students_org_created`
* [x] Add `idx_students_org_name`
* [x] Add `idx_trainers_org_name`
* [x] Add `idx_sponsors_org_name`
* [x] Add `idx_vendors_org_name`

### Batches / Qualifications

* [x] Add `idx_batches_org_status`
* [x] Add `idx_batches_org_qualification`
* [x] Add `idx_qualifications_org_code`

### Invoices / AR

* [x] Add `idx_invoices_org_status_date`
* [x] Add `idx_invoices_org_student`
* [x] Add `idx_invoices_org_sponsor`
* [x] Add `idx_invoice_lines_org_invoice`

### Payments

* [x] Add `idx_payments_org_status_date`
* [x] Add `idx_payment_applications_invoice_payment`

### Journal Entries / GL

* [x] Add `idx_journal_entries_org_status_date`
* [x] Add `idx_journal_entries_org_source`
* [x] Add `idx_journal_lines_entry_account`
* [x] Add `idx_journal_lines_contact`

### Audit Logs

* [x] Add `idx_audit_logs_org_created`
* [x] Add `idx_audit_logs_org_user_created`

### AP / Purchasing

* [x] Add `idx_payables_org_status_due`
* [x] Add `idx_payables_org_vendor`
* [x] Add `idx_purchase_orders_org_status_date`
* [x] Add `idx_purchase_orders_org_vendor`

---

# PHASE 2 — REMOVE select=* (CRITICAL)

## Goal

Reduce payload size and Supabase compute.

## Tasks

* [x] Scan all `.select('*')`
* [x] Replace with explicit columns
* [ ] Avoid unnecessary nested relationships
* [x] Create lightweight DTO-style responses

## High Priority Files

* [x] `SupabaseDataService.ts`
* [x] `App.tsx`
* [ ] Dashboard-related services
* [ ] Reporting modules

---

# PHASE 3 — SERVER-SIDE PAGINATION (CRITICAL)

## Goal

Prevent loading full tables into React memory.

## Create Generic Pagination Service

* [x] Add reusable `fetchPage()` method
* [ ] Support:

  * [x] page
  * [x] pageSize
  * [x] search
  * [x] filters
  * [x] orderBy
  * [x] count

## Convert Modules

### High Priority

* [ ] Students
* [ ] Invoices
* [ ] Payments
* [ ] Ledger
* [ ] Audit Trail
* [ ] Journal Entries
* [ ] Enrollments
* [ ] Inventory

### Medium Priority

* [ ] Vendors
* [ ] Sponsors
* [ ] Batches
* [ ] Qualifications
* [ ] Purchase Orders
* [ ] Payables

---

# PHASE 4 — REMOVE MASSIVE INITIAL LOAD (VERY CRITICAL)

## Current Problem

`getInitialData()` loads too many ERP tables during startup.

## Goal

Only load:

* authenticated user
* organization info
* permissions
* lightweight metadata

## Tasks

* [ ] Audit `getInitialData()`
* [ ] Remove invoices preload
* [ ] Remove payments preload
* [ ] Remove journal entries preload
* [ ] Remove students preload
* [ ] Remove enrollments preload
* [ ] Remove inventory preload
* [ ] Convert modules to lazy-load on page access

---

# PHASE 5 — DASHBOARD OPTIMIZATION (VERY HIGH IMPACT)

## Current Problem

Dashboard computes totals from huge in-memory arrays.

## Goal

Move calculations to PostgreSQL.

## Tasks

### Create RPC Functions

* [ ] `rpc_dashboard_ar_summary`
* [ ] `rpc_dashboard_registrar_summary`
* [ ] `rpc_dashboard_cashflow_summary`
* [ ] `rpc_dashboard_payables_summary`
* [ ] `rpc_dashboard_inventory_summary`

### Create SQL Views

* [ ] `v_ar_open_balances_by_contact`
* [ ] `v_monthly_collections`
* [ ] `v_batch_billing_status`
* [ ] `v_student_enrollment_summary`
* [ ] `v_gl_monthly_totals`

### React Dashboard Refactor

* [ ] Replace frontend aggregate loops
* [ ] Fetch lightweight summaries only
* [ ] Add dashboard caching
* [ ] Add date-range filters

---

# PHASE 6 — RLS POLICY OPTIMIZATION

## Goal

Reduce policy evaluation overhead.

## Tasks

* [ ] Audit all RLS policies
* [ ] Remove permissive `true` policies
* [ ] Ensure org_id filtering exists
* [ ] Add indexes supporting RLS filters
* [ ] Optimize auth.uid() usage
* [ ] Reduce nested subqueries inside policies

---

# PHASE 7 — REACT PERFORMANCE OPTIMIZATION

## Goal

Reduce frontend rendering lag.

## Tasks

* [ ] Add virtualization for large tables
* [ ] Prevent unnecessary rerenders
* [ ] Memoize expensive calculations
* [ ] Optimize useEffect dependencies
* [ ] Remove repeated API calls
* [ ] Add React Query/SWR caching
* [ ] Lazy-load heavy components

---

# PHASE 8 — REPORTING OPTIMIZATION

## Goal

Separate exports from UI rendering.

## Tasks

* [ ] Keep paginated UI lists
* [ ] Create dedicated export endpoints
* [ ] Use background export generation if needed
* [ ] Avoid loading full data into browser for exports

---

# PHASE 9 — OBSERVABILITY & MONITORING

## Goal

Monitor Supabase performance growth.

## Tasks

* [ ] Create SQL monitoring dashboard
* [ ] Track largest tables
* [ ] Track dead tuples
* [ ] Monitor sequential scans
* [ ] Monitor slow dashboard endpoints
* [ ] Track payload sizes

---

# PHASE 10 — LONG-TERM SCALABILITY

## Goal

Prepare ERP for larger tenants and more users.

## Tasks

* [ ] Introduce summary/materialized tables
* [ ] Archive old transactions
* [ ] Add monthly/yearly partition strategy later
* [ ] Consider backend API layer for sensitive modules
* [ ] Move heavy accounting logic into PostgreSQL RPCs

---

# SAFE IMPLEMENTATION RULES

## NEVER

* [ ] Remove accounting validations
* [ ] Remove audit logs
* [ ] Remove RLS
* [ ] Weaken permissions
* [ ] Load full tables unnecessarily
* [ ] Use `select=*` in production ERP modules

## ALWAYS

* [ ] Filter by `org_id`
* [ ] Use pagination
* [ ] Use explicit columns
* [ ] Add indexes safely
* [ ] Test locally first
* [ ] Benchmark before/after optimization

---

# SUCCESS TARGETS

## Backend

* [ ] Reduce Supabase compute usage
* [ ] Reduce payload size
* [ ] Reduce sequential scans
* [ ] Faster dashboard queries

## Frontend

* [ ] Faster startup
* [ ] Lower browser memory
* [ ] Smooth table rendering
* [ ] Faster page transitions

## SaaS Scalability

* [ ] Multi-tenant safe
* [ ] Scalable for large datasets
* [ ] Reduced free-tier pressure
* [ ] Production-ready architecture
