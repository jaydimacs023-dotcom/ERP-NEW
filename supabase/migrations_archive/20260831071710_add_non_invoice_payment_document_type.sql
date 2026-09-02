alter table public.invoices
  add column if not exists document_type text not null default 'INVOICE';

alter table public.invoices
  drop constraint if exists invoices_document_type_check;

alter table public.invoices
  add constraint invoices_document_type_check
  check (document_type in ('INVOICE', 'NON_INVOICE_PAYMENT'));

create index if not exists invoices_org_document_type_date_idx
  on public.invoices (org_id, document_type, invoice_date desc)
  where is_deleted = false;
