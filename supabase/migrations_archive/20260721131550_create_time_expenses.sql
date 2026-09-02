create table if not exists public.time_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rfq_code text not null,
  transaction_date date not null,
  description text not null,
  amount numeric(15,2) not null check (amount > 0),
  supplier_id uuid not null references public.vendors(id),
  claimed_by text not null,
  status text not null default 'open' check (status in ('open', 'billed')),
  payable_id uuid references public.payables(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_expenses_org_status_idx on public.time_expenses(org_id, status);
create index if not exists time_expenses_supplier_idx on public.time_expenses(supplier_id);
create unique index if not exists time_expenses_org_rfq_code_idx on public.time_expenses(org_id, rfq_code);

alter table public.time_expenses enable row level security;
grant select, insert, update, delete on public.time_expenses to authenticated;

create policy "time expenses tenant access" on public.time_expenses
  for all to authenticated
  using (org_id = (select u.org_id from public.users u where u.auth_uid = (select auth.uid()) limit 1))
  with check (org_id = (select u.org_id from public.users u where u.auth_uid = (select auth.uid()) limit 1));
