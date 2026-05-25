-- AT-ERP performance indexes for multi-tenant list, dashboard, and RLS-heavy queries.
--
-- Production note:
-- For very large Supabase Cloud tables, create these indexes with
-- CREATE INDEX CONCURRENTLY manually outside a transaction or during a low-traffic
-- maintenance window. Supabase migration runners may wrap files in a transaction,
-- so this migration intentionally uses regular CREATE INDEX IF NOT EXISTS.

-- Users / Authentication
create index if not exists idx_users_org_id
  on public.users (org_id);

create index if not exists idx_users_auth_uid
  on public.users (auth_uid);

-- Students / Trainers / Sponsors / Vendors
create index if not exists idx_students_org_created
  on public.students (org_id, created_at desc);

create index if not exists idx_students_org_name
  on public.students (org_id, last_name, first_name);

create index if not exists idx_trainers_org_name
  on public.trainers (org_id, last_name, first_name);

create index if not exists idx_sponsors_org_name
  on public.sponsors (org_id, name);

create index if not exists idx_vendors_org_name
  on public.vendors (org_id, name);

-- Batches / Qualifications
create index if not exists idx_batches_org_status
  on public.batches (org_id, status);

create index if not exists idx_batches_org_qualification
  on public.batches (org_id, qualification_id);

create index if not exists idx_qualifications_org_code
  on public.qualifications (org_id, code);

-- Invoices / AR
create index if not exists idx_invoices_org_status_date
  on public.invoices (org_id, status, invoice_date desc);

create index if not exists idx_invoices_org_student
  on public.invoices (org_id, student_id);

create index if not exists idx_invoices_org_sponsor
  on public.invoices (org_id, sponsor_id);

create index if not exists idx_invoice_lines_org_invoice
  on public.invoice_lines (org_id, invoice_id);

-- Payments
create index if not exists idx_payments_org_status_date
  on public.payments (org_id, status, payment_date desc);

create index if not exists idx_payment_applications_invoice_payment
  on public.payment_applications (invoice_id, payment_id);

-- Journal Entries / GL
create index if not exists idx_journal_entries_org_status_date
  on public.journal_entries (org_id, status, date desc);

create index if not exists idx_journal_entries_org_source
  on public.journal_entries (org_id, source_type, source_ref);

create index if not exists idx_journal_lines_entry_account
  on public.journal_lines (journal_entry_id, account_id);

create index if not exists idx_journal_lines_contact
  on public.journal_lines (contact_type, contact_id);

-- Audit Logs
create index if not exists idx_audit_logs_org_created
  on public.audit_logs (org_id, created_at desc);

create index if not exists idx_audit_logs_org_user_created
  on public.audit_logs (org_id, user_id, created_at desc);

-- AP / Purchasing
create index if not exists idx_payables_org_status_due
  on public.payables (org_id, status, due_date);

create index if not exists idx_payables_org_vendor
  on public.payables (org_id, vendor_id);

create index if not exists idx_purchase_orders_org_status_date
  on public.purchase_orders (org_id, status, order_date desc);

create index if not exists idx_purchase_orders_org_vendor
  on public.purchase_orders (org_id, vendor_id);
