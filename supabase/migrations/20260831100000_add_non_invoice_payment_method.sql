alter table public.invoices
  add column if not exists payment_method text;

alter table public.invoices
  drop constraint if exists invoices_payment_method_check;

alter table public.invoices
  add constraint invoices_payment_method_check
  check (payment_method is null or payment_method in ('CASH', 'BANK_TRANSFER', 'EWALLET'));
