alter table public.payables
  alter column vendor_id drop not null;

alter table public.payables
  drop constraint if exists payables_payee_required;

alter table public.payables
  add constraint payables_payee_required check (
    vendor_id is not null
    or (
      employee_id is not null
      and category = 'employee_reimbursements'
      and nullif(btrim(claimed_by), '') is not null
    )
  );
