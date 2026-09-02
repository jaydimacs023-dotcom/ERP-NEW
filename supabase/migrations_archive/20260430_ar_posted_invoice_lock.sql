create or replace function public.is_ar_invoice_accounting_locked(p_invoice public.invoices)
returns boolean
language sql
stable
as $$
  select
    upper(coalesce(p_invoice.status::text, '')) in ('OPEN', 'CLOSED', 'VOIDED')
    or p_invoice.journal_entry_id is not null
    or p_invoice.posted_at is not null
    or nullif(trim(coalesce(p_invoice.gl_entry_number, '')), '') is not null;
$$;

create or replace function public.prevent_posted_invoice_accounting_update()
returns trigger
language plpgsql
as $$
declare
  v_allowed_keys text[] := array[
    'amount_paid',
    'balance_due',
    'status',
    'journal_entry_id',
    'gl_entry_number',
    'posted_by',
    'posted_at',
    'voided_by',
    'voided_at',
    'void_reason',
    'updated_at',
    'updated_by'
  ];
  v_old_accounting jsonb;
  v_new_accounting jsonb;
  v_next_status text;
begin
  if not public.is_ar_invoice_accounting_locked(old) then
    return new;
  end if;

  v_old_accounting := to_jsonb(old) - v_allowed_keys;
  v_new_accounting := to_jsonb(new) - v_allowed_keys;

  if v_old_accounting is distinct from v_new_accounting then
    raise exception 'Posted invoices are locked. Reverse or void the invoice instead of changing accounting fields.';
  end if;

  if new.status is distinct from old.status then
    v_next_status := upper(coalesce(new.status::text, ''));
    if v_next_status not in ('OPEN', 'CLOSED', 'VOIDED') then
      raise exception 'Posted invoices cannot be moved back to draft/on-hold status.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_posted_invoice_accounting_update on public.invoices;
create trigger trg_prevent_posted_invoice_accounting_update
before update on public.invoices
for each row
execute function public.prevent_posted_invoice_accounting_update();

create or replace function public.prevent_posted_invoice_delete()
returns trigger
language plpgsql
as $$
begin
  if public.is_ar_invoice_accounting_locked(old) then
    raise exception 'Posted invoices cannot be deleted. Void the invoice instead.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_posted_invoice_delete on public.invoices;
create trigger trg_prevent_posted_invoice_delete
before delete on public.invoices
for each row
execute function public.prevent_posted_invoice_delete();

create or replace function public.prevent_posted_invoice_line_change()
returns trigger
language plpgsql
as $$
declare
  v_invoice_id uuid;
  v_invoice public.invoices%rowtype;
begin
  if tg_op = 'DELETE' then
    v_invoice_id := old.invoice_id;
  else
    v_invoice_id := new.invoice_id;
  end if;

  if v_invoice_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select *
    into v_invoice
  from public.invoices
  where id = v_invoice_id;

  if found and public.is_ar_invoice_accounting_locked(v_invoice) then
    raise exception 'Posted invoice lines are locked. Reverse or void the invoice instead of changing lines.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_posted_invoice_line_insert on public.invoice_lines;
create trigger trg_prevent_posted_invoice_line_insert
before insert on public.invoice_lines
for each row
execute function public.prevent_posted_invoice_line_change();

drop trigger if exists trg_prevent_posted_invoice_line_update on public.invoice_lines;
create trigger trg_prevent_posted_invoice_line_update
before update on public.invoice_lines
for each row
execute function public.prevent_posted_invoice_line_change();

drop trigger if exists trg_prevent_posted_invoice_line_delete on public.invoice_lines;
create trigger trg_prevent_posted_invoice_line_delete
before delete on public.invoice_lines
for each row
execute function public.prevent_posted_invoice_line_change();
