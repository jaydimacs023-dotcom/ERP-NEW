alter table public.sponsors
  add column if not exists customer_type text not null default 'SPONSOR';

alter table public.sponsors
  drop constraint if exists sponsors_customer_type_check;

alter table public.sponsors
  add constraint sponsors_customer_type_check
  check (customer_type in ('SPONSOR', 'OTHER'));

create index if not exists sponsors_org_customer_type_name_idx
  on public.sponsors (org_id, customer_type, name);
