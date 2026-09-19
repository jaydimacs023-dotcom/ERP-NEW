-- Security remediation for AP, AR, and Registrar data.
-- This migration intentionally removes anonymous Data API access and makes
-- authenticated tenant/role claims mandatory for all covered tables.

create schema if not exists private;

create or replace function private.erp_claim_text(p_name text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(coalesce(
    auth.jwt() ->> p_name,
    case p_name
      when 'org_id' then auth.jwt() ->> 'orgId'
      when 'app_role' then auth.jwt() ->> 'appRole'
      else null
    end
  ), '');
$$;

create or replace function private.erp_org_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select private.erp_claim_text('org_id')::uuid;
$$;

create or replace function private.erp_app_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select upper(private.erp_claim_text('app_role'));
$$;

create or replace function private.erp_is_system_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.erp_app_role() = 'SYSTEM_ADMIN';
$$;

create or replace function private.erp_has_role(variadic p_roles text[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.erp_app_role() = any (
    select upper(role_name) from unnest(p_roles) role_name
  );
$$;

revoke all on function private.erp_claim_text(text) from public, anon;
revoke all on function private.erp_org_id() from public, anon;
revoke all on function private.erp_app_role() from public, anon;
revoke all on function private.erp_is_system_admin() from public, anon;
revoke all on function private.erp_has_role(text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.erp_claim_text(text) to authenticated;
grant execute on function private.erp_org_id() to authenticated;
grant execute on function private.erp_app_role() to authenticated;
grant execute on function private.erp_is_system_admin() to authenticated;
grant execute on function private.erp_has_role(text[]) to authenticated;

-- Remove legacy permissive policies before installing the role-aware set.
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_org_isolation on public.invoices;
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoice_lines_delete on public.invoice_lines;
drop policy if exists invoice_lines_insert on public.invoice_lines;
drop policy if exists invoice_lines_org_isolation on public.invoice_lines;
drop policy if exists invoice_lines_select on public.invoice_lines;
drop policy if exists invoice_lines_update on public.invoice_lines;
drop policy if exists payments_delete_anon_unblock on public.payments;
drop policy if exists payments_insert_anon on public.payments;
drop policy if exists payments_select_anon on public.payments;
drop policy if exists payments_select_anon_unblock on public.payments;
drop policy if exists payments_update_anon on public.payments;
drop policy if exists payments_update_anon_unblock on public.payments;
drop policy if exists payment_applications_delete_anon_unblock on public.payment_applications;
drop policy if exists payment_applications_insert_anon on public.payment_applications;
drop policy if exists payment_applications_insert_anon_unblock on public.payment_applications;
drop policy if exists payment_applications_select_anon on public.payment_applications;
drop policy if exists payment_applications_select_anon_unblock on public.payment_applications;
drop policy if exists payment_applications_update_anon on public.payment_applications;
drop policy if exists payment_applications_update_anon_unblock on public.payment_applications;
drop policy if exists enrollments_org_isolation on public.enrollments;

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.payment_applications enable row level security;
alter table public.payables enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.assessment_registrations enable row level security;

revoke all on public.invoices, public.invoice_lines, public.payments,
  public.payment_applications, public.payables, public.students,
  public.enrollments, public.assessment_registrations from anon;

grant select, insert, update, delete on public.invoices, public.invoice_lines,
  public.payments, public.payment_applications, public.payables, public.students,
  public.enrollments, public.assessment_registrations to authenticated;

create policy invoices_tenant_select on public.invoices for select to authenticated
using (private.erp_is_system_admin() or org_id = private.erp_org_id());
create policy invoices_ar_insert on public.invoices for insert to authenticated
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'));
create policy invoices_ar_update on public.invoices for update to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'))
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'));
create policy invoices_ar_delete on public.invoices for delete to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','AR_SPECIALIST'));

create policy invoice_lines_tenant_select on public.invoice_lines for select to authenticated
using (exists (select 1 from public.invoices i where i.id = invoice_id and
  (private.erp_is_system_admin() or i.org_id = private.erp_org_id())));
create policy invoice_lines_ar_insert on public.invoice_lines for insert to authenticated
with check (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST') and
  exists (select 1 from public.invoices i where i.id = invoice_id and
    (private.erp_is_system_admin() or i.org_id = private.erp_org_id())));
create policy invoice_lines_ar_update on public.invoice_lines for update to authenticated
using (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST') and
  exists (select 1 from public.invoices i where i.id = invoice_id and
    (private.erp_is_system_admin() or i.org_id = private.erp_org_id())))
with check (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST') and
  exists (select 1 from public.invoices i where i.id = invoice_id and
    (private.erp_is_system_admin() or i.org_id = private.erp_org_id())));
create policy invoice_lines_ar_delete on public.invoice_lines for delete to authenticated
using (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','AR_SPECIALIST') and
  exists (select 1 from public.invoices i where i.id = invoice_id and
    (private.erp_is_system_admin() or i.org_id = private.erp_org_id())));

create policy payments_tenant_select on public.payments for select to authenticated
using (private.erp_is_system_admin() or org_id = private.erp_org_id());
create policy payments_ar_insert on public.payments for insert to authenticated
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'));
create policy payments_ar_update on public.payments for update to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'))
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'));
create policy payments_ar_delete on public.payments for delete to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','AR_SPECIALIST'));

create policy payment_applications_tenant_select on public.payment_applications for select to authenticated
using (exists (select 1 from public.payments p join public.invoices i on i.id = invoice_id
  where p.id = payment_id and p.org_id = i.org_id and
  (private.erp_is_system_admin() or p.org_id = private.erp_org_id())));
create policy payment_applications_ar_insert on public.payment_applications for insert to authenticated
with check (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST') and
  exists (select 1 from public.payments p join public.invoices i on i.id = invoice_id
    where p.id = payment_id and p.org_id = i.org_id and
    (private.erp_is_system_admin() or p.org_id = private.erp_org_id())));
create policy payment_applications_ar_update on public.payment_applications for update to authenticated
using (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST') and
  exists (select 1 from public.payments p join public.invoices i on i.id = invoice_id
    where p.id = payment_id and p.org_id = i.org_id and
    (private.erp_is_system_admin() or p.org_id = private.erp_org_id())))
with check (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AR_SPECIALIST'));
create policy payment_applications_ar_delete on public.payment_applications for delete to authenticated
using (private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','AR_SPECIALIST') and
  exists (select 1 from public.payments p where p.id = payment_id and
    (private.erp_is_system_admin() or p.org_id = private.erp_org_id())));

create policy payables_tenant_select on public.payables for select to authenticated
using (private.erp_is_system_admin() or org_id = private.erp_org_id());
create policy payables_ap_insert on public.payables for insert to authenticated
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AP_SPECIALIST','AP_CLERK','AP_SUPERVISOR'));
create policy payables_ap_update on public.payables for update to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AP_SPECIALIST','AP_CLERK','AP_SUPERVISOR'))
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT','AP_SPECIALIST','AP_CLERK','AP_SUPERVISOR'));
create policy payables_ap_delete on public.payables for delete to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','AP_SUPERVISOR'));

create policy students_tenant_select on public.students for select to authenticated
using (private.erp_is_system_admin() or org_id = private.erp_org_id());
create policy students_registrar_insert on public.students for insert to authenticated
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR','AR_SPECIALIST'));
create policy students_registrar_update on public.students for update to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'))
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));
create policy students_registrar_delete on public.students for delete to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));

create policy enrollments_tenant_select on public.enrollments for select to authenticated
using (private.erp_is_system_admin() or org_id = private.erp_org_id());
create policy enrollments_registrar_insert on public.enrollments for insert to authenticated
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));
create policy enrollments_registrar_update on public.enrollments for update to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'))
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));
create policy enrollments_registrar_delete on public.enrollments for delete to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));

create policy assessments_tenant_select on public.assessment_registrations for select to authenticated
using (private.erp_is_system_admin() or org_id = private.erp_org_id());
create policy assessments_registrar_insert on public.assessment_registrations for insert to authenticated
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));
create policy assessments_registrar_update on public.assessment_registrations for update to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR','AR_SPECIALIST'))
with check ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR','AR_SPECIALIST'));
create policy assessments_registrar_delete on public.assessment_registrations for delete to authenticated
using ((private.erp_is_system_admin() or org_id = private.erp_org_id()) and
  private.erp_has_role('SYSTEM_ADMIN','ADMIN','REGISTRAR'));

-- Sensitive posting RPCs remain service-role-only until a forward migration
-- installs an authenticated wrapper that derives and validates the actor.
revoke all on function public.post_payable_bill(uuid, uuid) from public, anon, authenticated;
grant execute on function public.post_payable_bill(uuid, uuid) to service_role;

create index if not exists users_auth_uid_idx on public.users(auth_uid);
create index if not exists payment_applications_payment_invoice_idx
  on public.payment_applications(payment_id, invoice_id);
