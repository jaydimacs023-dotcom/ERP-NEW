alter table public.invoice_lines
  add column if not exists org_id uuid,
  add column if not exists net_amount numeric(14, 2),
  add column if not exists gross_amount numeric(14, 2),
  add column if not exists classification_code text;

alter table public.journal_lines
  add column if not exists classification_code text,
  add column if not exists tax_category_id uuid;

update public.invoice_lines
set
  net_amount = coalesce(net_amount, amount),
  gross_amount = coalesce(gross_amount, amount)
where net_amount is null
   or gross_amount is null;
