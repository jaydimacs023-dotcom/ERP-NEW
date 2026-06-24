# Database

## Overview
The database is Supabase Postgres. The main schema source in the repository is `accountech.sql` / `accountech-runnable-schema.sql`, with incremental changes under `supabase/migrations/`.

Application code uses camelCase TypeScript models and persists to snake_case tables. `SupabaseDataService` performs conversion and filters payloads to known table schemas where needed.

## Runtime Access Pattern
- Reads primarily use Supabase REST: `/rest/v1/{table}`.
- Writes primarily use REST helpers in `SupabaseDataService`.
- Privileged writes use Edge Functions under `/functions/v1`.
- Number generation and business helpers use RPC calls.
- Soft deletes are common through `is_deleted`, `deleted_at`, and `deleted_by`.

## Active Migrations
Active migration files:
- `20260524_add_organization_institution_type.sql`: adds `organizations.institution_type`, defaults existing rows to `TRAINING`, enforces `TRAINING | ACADEMIC | HYBRID`, and indexes the field.
- `20260524_performance_indexes.sql`: adds indexes for common org-scoped, status, date, customer, vendor, journal, audit, AP, AR, and procurement queries.

Disabled migration files document intended or previously staged features:
- AR invoice line accounting fields, invoice number control, posted invoice locking.
- Journal entry reversal RPC.
- Payment application GL linkage.
- Feedback tickets.
- Assessment registrations and assessment status changes.
- Sponsored batch billing caps and enrollment billing types.
- TESDA student form fields.
- User profile fields.

Do not assume `.disabled` files are applied in a deployed database.

## Core Tables
Tenant and identity:
- `organizations`: tenants, currency, VAT flag, subscription status, plan type, pending plan, payment reference, license expiry, color, logo, and institution type from migration.
- `users`: org user rows, email, password hash/salt, role, auth UID, active/lock state, optional `student_id` or `trainer_id`, profile fields.
- `audit_logs`: user/org activity logs with entity metadata and details.
- `feedback_tickets`: support tickets with status, priority, assignment, screenshot data URL, and org/user linkage.

Training operations:
- `students`: learner profile, ULI, personal/contact/address fields, TESDA fields, profile photo, sponsor/location links, and document array.
- `trainers`: trainer profile and qualification links.
- `qualifications`: course/qualification code, name, duration, and sector.
- `batches`: qualification, trainer, optional sponsor/location, dates, status, capacity, student IDs, and billable student limit.
- `locations` and `trainer_schedules`: physical locations and training schedules.
- `enrollments`: student/batch/sponsor link, enrollment status, billing status, billing type, dates, total fees, billed amount.
- `assessment_registrations`: student qualification assessments with billing party, assessment type/date/status, fees, billing status, invoice link.
- `alumni_employment_reports`: student employment outcomes.

Accounts receivable:
- `course_fees`: qualification fee catalog with category, amount, GL account, tax category, VAT settings, and active flag.
- `invoices`: invoice number, sponsor/student/enrollment/batch/assessment links, dates, status, subtotal, VAT, EWT, totals, paid/balance amounts, posting and void metadata.
- `invoice_lines`: invoice detail lines with course fee/enrollment/assessment links, quantity, unit price, amount, VAT, GL account, classification, line type.
- `payments`: payment number, payer, payment method, bank/check fields, amount received, EWT certified, applied amount, customer deposit balance, posting/void metadata.
- `payment_applications`: payment-to-invoice applications, applied amount, reversal metadata, optional GL linkage in disabled migration.
- `bank_deposits` and `bank_deposit_lines`: deposit batches, bank account, included payments, status, posting/void metadata.

Accounts payable and procurement:
- `vendors`: vendor master with AP account and contact data.
- `vendor_tax_settings`, `atc_categories`, `atc_items`, `atc_rates`: withholding tax setup.
- `payables`: payable number, vendor, category, amount, bill/due/payment dates, status, withholding, GL account, approval/payment metadata.
- `bills`: vendor bill payload, gross/net amounts, VAT/EWT totals, status, journal link.
- `purchase_orders` and `purchase_order_items`: procurement order headers and lines.
- `goods_receipts` and `goods_receipt_lines`: receiving records tied to POs/vendors and optional GL posting.
- `check_vouchers` and `check_number_settings`: check issuance, status, numbering, bank account, approval/print/release/clear/void metadata.

General ledger and finance:
- `chart_of_accounts`: tenant chart of accounts with account class, normal balance, parent links, and active flag.
- `journal_entries`: org, period, date, description, reference, status, source type/id, approval/posting/reversal metadata, GL entry number.
- `journal_lines`: journal entry lines with account, debit, credit, contact/project/location dimensions, clearing flags, and source metadata.
- `accounting_periods`: period type/year/number/date range, AP/AR/GL close flags, status, lock metadata.
- `bank_accounts` and `bank_reconciliations`: cash accounts and reconciliation state.
- `fixed_assets`: asset master with category, cost, accumulated depreciation, GL account, and useful life.
- `exchange_rates`: multi-currency rate records.
- `budgets` and budget lines are represented in TypeScript and views; confirm deployed SQL before relying on physical tables.

Inventory:
- `warehouse_locations`: inventory location master.
- `stock_items`: item code/name, price/cost, default warehouse, income/COGS/expense/tax accounts, valuation method, min/max/reorder levels.
- `inventory_levels`: quantity on hand/reserved/available by item/location.
- `inventory_transactions`: purchase/sale/adjustment/transfer/return/damage/writeoff movements with cost and journal link.
- `stock_adjustments`: adjustment requests with approval and journal metadata.
- `reorder_points`: reorder thresholds per stock item.

Payroll and compliance:
- `employees`, `payroll_runs`, and `payroll_lines`: employee master, run headers, and line totals.
- Payroll tax/contribution/attendance/leave/BIR structures are defined in `types.ts` and services. Confirm SQL availability before persisting new tables.

## Key Relationships
- Most operational tables reference `organizations.id` through `org_id`.
- `users.org_id` references `organizations.id`; student/trainer portal users may also carry `student_id` or `trainer_id`.
- `students`, `trainers`, `qualifications`, `locations`, `sponsors`, and `batches` form the training core.
- `enrollments` link students to batches and optionally sponsors.
- `assessment_registrations` link students and qualifications, optionally sponsors and invoices.
- `invoices` link to sponsors or students, and optionally enrollments, batches, assessments, and journal entries.
- `invoice_lines` link to invoices and optionally course fees, enrollments, and assessments.
- `payments` link to sponsors/students, bank accounts, and journal entries.
- `payment_applications` link payments to invoices.
- `payables`, `bills`, `purchase_orders`, `goods_receipts`, and `check_vouchers` link vendors, bank accounts, journal entries, and users.
- `stock_items` link warehouse locations and GL accounts; inventory transactions/levels/adjustments link stock items and locations.
- `journal_lines` link journal entries and chart accounts.

## RPC And Functions
RPC calls used by the app include:
- `get_next_invoice_no`
- `get_next_payment_no`
- `get_next_payment_application_no`
- `billing_billable_qty`
- `billing_course_fee_invoice`
- journal reversal RPC referenced by `SupabaseDataService` and the disabled reversal migration.

Edge Functions:
- `organizations-write`: service-role organization create/update/delete with JWT role checks.
- `users-write`: service-role user creation with role normalization and student/trainer link checks.
- `payments-write`: service-role payment creation/application workflows.
- `feedback-tickets`: feedback ticket create/update/list with org/system-admin scope.

## Indexing
The active performance migration adds indexes for:
- user org/auth lookup,
- student/trainer/sponsor/vendor org/name searches,
- batch org/status and qualification lookup,
- invoice org/status/date, student, sponsor lookup,
- invoice lines by org/invoice,
- payments by org/status/date,
- payment applications by invoice/payment,
- journal entries by org/status/date and source,
- journal lines by entry/account and contact,
- audit logs by org/date and org/user/date,
- payables by org/status/due date and vendor,
- purchase orders by org/status/date and vendor.

## Data Integrity Notes
- Many status values are enforced by SQL `CHECK` constraints or enum-like TypeScript unions.
- Some deployed databases only allow `DRAFT`, `POSTED`, and `VOIDED` for `payments.status`; the app maps UI statuses where needed.
- The SQL dump uses both `uuid_generate_v4()` and `gen_random_uuid()`.
- Soft deletion is preferred for many entities, but some Edge Functions and helpers can perform hard deletes.
- RLS appears in disabled migration files for some tables. Confirm deployed RLS policies before changing authorization assumptions.
