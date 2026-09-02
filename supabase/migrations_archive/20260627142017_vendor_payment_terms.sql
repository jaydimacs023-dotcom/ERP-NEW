alter table public.vendors
  add column if not exists payment_terms_days integer not null default 30;

alter table public.vendors
  drop constraint if exists vendors_payment_terms_days_check;

alter table public.vendors
  add constraint vendors_payment_terms_days_check
  check (payment_terms_days >= 0);
