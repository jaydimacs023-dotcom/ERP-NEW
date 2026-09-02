-- Align the legacy stock_items table with the active Stock Items screen.
-- Stock quantities remain warehouse-specific in inventory_levels, so a stock
-- item definition no longer requires one warehouse location.

alter table public.stock_items
  add column if not exists type text not null default 'STOCK_ITEM',
  add column if not exists unit_of_measure text not null default 'PCS',
  add column if not exists reorder_level numeric not null default 0,
  add column if not exists safety_stock numeric not null default 0,
  add column if not exists is_active boolean not null default true;

update public.stock_items
set reorder_level = coalesce(min_stock_level, 0)
where reorder_level = 0
  and coalesce(min_stock_level, 0) <> 0;

alter table public.stock_items
  alter column warehouse_location_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_items_type_check'
      and conrelid = 'public.stock_items'::regclass
  ) then
    alter table public.stock_items
      add constraint stock_items_type_check
      check (type in ('STOCK_ITEM', 'NON_STOCK_ITEM'));
  end if;
end
$$;

comment on column public.stock_items.reorder_level is
  'Quantity at or below which the item should be reordered.';

comment on column public.stock_items.safety_stock is
  'Operational buffer quantity retained below the reorder level.';
