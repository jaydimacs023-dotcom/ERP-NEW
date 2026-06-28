alter table public.stock_adjustments
  add column if not exists adjustment_type text not null default 'ADJUSTMENT';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_adjustments_adjustment_type_check'
      and conrelid = 'public.stock_adjustments'::regclass
  ) then
    alter table public.stock_adjustments
      add constraint stock_adjustments_adjustment_type_check
      check (adjustment_type in ('DAMAGE', 'WRITEOFF', 'ADJUSTMENT', 'CORRECTION'));
  end if;
end
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.apply_inventory_level_delta(
  p_org_id uuid,
  p_stock_item_id uuid,
  p_warehouse_location_id uuid,
  p_quantity_change numeric
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.inventory_levels (
    org_id,
    stock_item_id,
    warehouse_location_id,
    quantity_on_hand,
    quantity_reserved,
    quantity_available,
    last_counted,
    updated_at,
    is_deleted
  )
  values (
    p_org_id,
    p_stock_item_id,
    p_warehouse_location_id,
    p_quantity_change,
    0,
    p_quantity_change,
    now(),
    now(),
    false
  )
  on conflict (org_id, stock_item_id, warehouse_location_id)
  do update set
    quantity_on_hand = coalesce(public.inventory_levels.quantity_on_hand, 0) + excluded.quantity_on_hand,
    quantity_available =
      coalesce(public.inventory_levels.quantity_on_hand, 0)
      + excluded.quantity_on_hand
      - coalesce(public.inventory_levels.quantity_reserved, 0),
    last_counted = now(),
    updated_at = now(),
    is_deleted = false;
end;
$$;

revoke all on function private.apply_inventory_level_delta(uuid, uuid, uuid, numeric) from public;

create or replace function private.sync_approved_stock_adjustment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  old_effective boolean := false;
  new_effective boolean := false;
begin
  if tg_op <> 'INSERT' then
    old_effective := old.approval_date is not null and not coalesce(old.is_deleted, false);
  end if;
  if tg_op <> 'DELETE' then
    new_effective := new.approval_date is not null and not coalesce(new.is_deleted, false);
  end if;

  if old_effective then
    perform private.apply_inventory_level_delta(
      old.org_id,
      old.stock_item_id,
      old.warehouse_location_id,
      -old.quantity_change
    );
  end if;

  if new_effective then
    perform private.apply_inventory_level_delta(
      new.org_id,
      new.stock_item_id,
      new.warehouse_location_id,
      new.quantity_change
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.sync_approved_stock_adjustment() from public;

drop trigger if exists sync_approved_stock_adjustment on public.stock_adjustments;
create trigger sync_approved_stock_adjustment
after insert or update or delete on public.stock_adjustments
for each row execute function private.sync_approved_stock_adjustment();
