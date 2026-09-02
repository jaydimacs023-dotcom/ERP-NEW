create table if not exists public.feedback_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  title text not null,
  description text not null,
  screenshot_data_url text,
  screenshot_name text,
  status text not null default 'OPEN',
  priority text not null default 'MEDIUM',
  created_by uuid,
  created_by_name text not null,
  created_by_role text not null,
  assigned_to uuid,
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint feedback_tickets_status_check
    check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  constraint feedback_tickets_priority_check
    check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT'))
);

do $$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1 from pg_constraint where conname = 'feedback_tickets_org_id_fkey'
    )
  then
    alter table public.feedback_tickets
      add constraint feedback_tickets_org_id_fkey
      foreign key (org_id) references public.organizations(id);
  end if;

  if to_regclass('public.users') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'feedback_tickets_created_by_fkey'
    ) then
      alter table public.feedback_tickets
        add constraint feedback_tickets_created_by_fkey
        foreign key (created_by) references public.users(id);
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'feedback_tickets_assigned_to_fkey'
    ) then
      alter table public.feedback_tickets
        add constraint feedback_tickets_assigned_to_fkey
        foreign key (assigned_to) references public.users(id);
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'feedback_tickets_deleted_by_fkey'
    ) then
      alter table public.feedback_tickets
        add constraint feedback_tickets_deleted_by_fkey
        foreign key (deleted_by) references public.users(id);
    end if;
  end if;
end $$;

create index if not exists idx_feedback_tickets_org_id
  on public.feedback_tickets(org_id);

create index if not exists idx_feedback_tickets_created_by
  on public.feedback_tickets(created_by);

create index if not exists idx_feedback_tickets_status
  on public.feedback_tickets(status);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feedback_tickets'
      and column_name = 'org_id'
      and is_nullable = 'YES'
  ) and not exists (
    select 1 from public.feedback_tickets where org_id is null
  ) then
    alter table public.feedback_tickets alter column org_id set not null;
  end if;
end $$;

alter table public.feedback_tickets enable row level security;

revoke select, insert, update, delete on public.feedback_tickets from anon, authenticated;

drop policy if exists "feedback tickets are visible to owner and system admin"
  on public.feedback_tickets;

drop policy if exists "authenticated users can create own feedback tickets"
  on public.feedback_tickets;

drop policy if exists "system admin can update feedback tickets"
  on public.feedback_tickets;

create index if not exists idx_feedback_tickets_org_created_by
  on public.feedback_tickets(org_id, created_by);
