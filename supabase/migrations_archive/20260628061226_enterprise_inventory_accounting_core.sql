-- Enterprise inventory accounting foundation.
create table if not exists public.inventory_classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  inventory_asset_account_id uuid not null references public.chart_of_accounts(id),
  cogs_account_id uuid not null references public.chart_of_accounts(id),
  adjustment_account_id uuid not null references public.chart_of_accounts(id),
  purchase_price_variance_account_id uuid references public.chart_of_accounts(id),
  in_transit_account_id uuid references public.chart_of_accounts(id),
  write_off_account_id uuid references public.chart_of_accounts(id),
  opening_balance_equity_account_id uuid references public.chart_of_accounts(id),
  default_warehouse_id uuid references public.warehouse_locations(id),
  valuation_method text not null default 'WEIGHTED_AVERAGE'
    check (valuation_method in ('FIFO','WEIGHTED_AVERAGE','STANDARD_COST')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);

alter table public.stock_items
  add column if not exists inventory_class_id uuid references public.inventory_classes(id),
  add column if not exists default_warehouse_id uuid references public.warehouse_locations(id),
  add column if not exists standard_cost numeric(18,4) not null default 0,
  add column if not exists valuation_method_override text,
  add column if not exists barcode text,
  add column if not exists brand text,
  add column if not exists category text,
  add column if not exists preferred_supplier_id uuid references public.vendors(id);

create table if not exists public.inventory_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null references public.inventory_transactions(id),
  stock_item_id uuid not null references public.stock_items(id),
  warehouse_location_id uuid not null references public.warehouse_locations(id),
  posting_date date not null,
  quantity_change numeric(18,4) not null check (quantity_change <> 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  extended_cost numeric(18,4) not null,
  running_quantity numeric(18,4) not null,
  running_value numeric(18,4) not null,
  created_at timestamptz not null default now(),
  unique (transaction_id, warehouse_location_id)
);

alter table public.inventory_transactions
  add column if not exists posting_date date,
  add column if not exists status text not null default 'DRAFT',
  add column if not exists source_document text,
  add column if not exists source_module text,
  add column if not exists posted_by uuid references public.users(id),
  add column if not exists posted_at timestamptz,
  add column if not exists reversal_of_id uuid references public.inventory_transactions(id),
  add column if not exists batch_lot text,
  add column if not exists serial_number text;

create table if not exists public.opening_inventory_headers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_number text not null,
  posting_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','POSTED','REVERSED')),
  remarks text,
  journal_entry_id uuid references public.journal_entries(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  posted_by uuid references public.users(id),
  posted_at timestamptz,
  unique (org_id, document_number)
);

create table if not exists public.opening_inventory_lines (
  id uuid primary key default gen_random_uuid(),
  header_id uuid not null references public.opening_inventory_headers(id) on delete cascade,
  warehouse_location_id uuid not null references public.warehouse_locations(id),
  stock_item_id uuid not null references public.stock_items(id),
  quantity numeric(18,4) not null check (quantity > 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  batch_lot text,
  expiration_date date,
  remarks text
);

create index if not exists inventory_classes_org_active_idx
  on public.inventory_classes(org_id, code) where is_active;
create index if not exists stock_items_inventory_class_idx on public.stock_items(inventory_class_id);
create index if not exists inventory_ledger_item_warehouse_date_idx
  on public.inventory_ledger(org_id, stock_item_id, warehouse_location_id, posting_date, id);
create index if not exists inventory_transactions_posted_idx
  on public.inventory_transactions(org_id, posting_date, stock_item_id) where status = 'POSTED';
create index if not exists opening_inventory_lines_header_idx on public.opening_inventory_lines(header_id);

alter table public.inventory_classes enable row level security;
alter table public.inventory_ledger enable row level security;
alter table public.opening_inventory_headers enable row level security;
alter table public.opening_inventory_lines enable row level security;

-- Posted transactions and ledger entries are append-only.
create or replace function private.protect_posted_inventory_records()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_table_name = 'inventory_ledger' then
    raise exception 'Inventory ledger entries are immutable';
  end if;
  if old.status = 'POSTED' then
    raise exception 'Posted inventory transactions are immutable; create a reversal';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_inventory_ledger on public.inventory_ledger;
create trigger protect_inventory_ledger before update or delete on public.inventory_ledger
for each row execute function private.protect_posted_inventory_records();
drop trigger if exists protect_posted_inventory_transaction on public.inventory_transactions;
create trigger protect_posted_inventory_transaction before update or delete on public.inventory_transactions
for each row execute function private.protect_posted_inventory_records();

-- Expand legacy transaction/source constraints for enterprise inventory events.
alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_transaction_type_check;
alter table public.inventory_transactions
  add constraint inventory_transactions_transaction_type_check check (
    transaction_type in (
      'OPENING_INVENTORY','PURCHASE_RECEIPT','PURCHASE_RETURN','SALES_ISSUE',
      'SALES_RETURN','TRANSFER_IN','TRANSFER_OUT','STOCK_ADJUSTMENT',
      'PRODUCTION_RECEIPT','PRODUCTION_CONSUMPTION','INVENTORY_WRITEOFF',
      'CYCLE_COUNT_ADJUSTMENT','REVERSAL',
      'PURCHASE','SALE','ADJUSTMENT','TRANSFER','RETURN','DAMAGE','WRITEOFF'
    )
  );

alter table public.journal_entries
  drop constraint if exists journal_entries_source_type_check;
alter table public.journal_entries
  add constraint journal_entries_source_type_check check (
    source_type in (
      'MANUAL','INVOICE','BILL','PAYMENT','COLLECTION','DEPRECIATION',
      'TRANSFER','PURCHASE_ORDER','PAYROLL','CREDIT_MEMO','GR_IR','ACCRUAL',
      'REVERSAL','APPLICATION','VOID','DEPOSIT','INVENTORY'
    )
  );

create or replace function public.post_inventory_movement(
  p_org_id uuid,
  p_stock_item_id uuid,
  p_warehouse_location_id uuid,
  p_transaction_type text,
  p_quantity_change numeric,
  p_unit_cost numeric,
  p_posting_date date,
  p_source_document text,
  p_source_module text,
  p_reason text,
  p_actor_id uuid,
  p_batch_lot text default null,
  p_serial_number text default null,
  p_reversal_of_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_item public.stock_items%rowtype;
  v_class public.inventory_classes%rowtype;
  v_transaction_id uuid;
  v_journal_id uuid;
  v_reference text;
  v_cost numeric(18,4);
  v_amount numeric(18,4);
  v_current_qty numeric(18,4);
  v_current_value numeric(18,4);
  v_cached_qty numeric(18,4);
  v_has_ledger boolean;
  v_new_qty numeric(18,4);
  v_new_value numeric(18,4);
  v_debit_account uuid;
  v_credit_account uuid;
begin
  if p_quantity_change = 0 then raise exception 'Inventory quantity change cannot be zero'; end if;
  if p_posting_date is null then raise exception 'Posting date is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_org_id::text || ':' || p_stock_item_id::text || ':' || p_warehouse_location_id::text, 0
  ));

  select * into v_item from public.stock_items
  where id = p_stock_item_id and org_id = p_org_id and not coalesce(is_deleted, false);
  if not found then raise exception 'Stock item not found in organization'; end if;
  if v_item.inventory_class_id is null then raise exception 'Stock item requires an Inventory Class before posting'; end if;

  select * into v_class from public.inventory_classes
  where id = v_item.inventory_class_id and org_id = p_org_id and is_active;
  if not found then raise exception 'Active Inventory Class not found'; end if;

  select coalesce(running_quantity, 0), coalesce(running_value, 0)
    into v_current_qty, v_current_value
  from public.inventory_ledger
  where org_id = p_org_id
    and stock_item_id = p_stock_item_id
    and warehouse_location_id = p_warehouse_location_id
  order by id desc limit 1;
  v_has_ledger := found;
  if not v_has_ledger then
    select coalesce(quantity_on_hand, 0) into v_cached_qty
    from public.inventory_levels
    where org_id = p_org_id
      and stock_item_id = p_stock_item_id
      and warehouse_location_id = p_warehouse_location_id
      and not coalesce(is_deleted, false);
    if coalesce(v_cached_qty, 0) <> 0 and p_transaction_type <> 'OPENING_INVENTORY' then
      raise exception 'Legacy stock balance % must be migrated through Opening Inventory before posting movements', v_cached_qty;
    end if;
  end if;
  v_current_qty := coalesce(v_current_qty, 0);
  v_current_value := coalesce(v_current_value, 0);
  if p_quantity_change < 0 and v_current_qty > 0
     and coalesce(v_item.valuation_method_override, v_class.valuation_method) = 'WEIGHTED_AVERAGE' then
    v_cost := round(v_current_value / v_current_qty, 4);
  else
    v_cost := coalesce(nullif(p_unit_cost, 0), v_item.standard_cost, 0);
  end if;
  if v_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;
  v_amount := round(abs(p_quantity_change) * v_cost, 4);
  v_new_qty := v_current_qty + p_quantity_change;
  if v_new_qty < 0 then raise exception 'Insufficient stock: available %, requested %', v_current_qty, abs(p_quantity_change); end if;
  v_new_value := v_current_value + case when p_quantity_change > 0 then v_amount else -v_amount end;

  v_reference := concat('INV-', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), '-', upper(substr(gen_random_uuid()::text, 1, 6)));
  insert into public.inventory_transactions (
    org_id, reference_number, stock_item_id, transaction_type, to_location_id,
    quantity, unit_cost, total_cost, notes, created_by, posting_date, status,
    source_document, source_module, posted_by, posted_at, reversal_of_id,
    batch_lot, serial_number, is_deleted
  ) values (
    p_org_id, v_reference, p_stock_item_id, p_transaction_type, p_warehouse_location_id,
    abs(p_quantity_change), v_cost, v_amount, p_reason, p_actor_id, p_posting_date, 'DRAFT',
    p_source_document, p_source_module, p_actor_id, now(), p_reversal_of_id,
    p_batch_lot, p_serial_number, false
  ) returning id into v_transaction_id;

  insert into public.inventory_ledger (
    org_id, transaction_id, stock_item_id, warehouse_location_id, posting_date,
    quantity_change, unit_cost, extended_cost, running_quantity, running_value
  ) values (
    p_org_id, v_transaction_id, p_stock_item_id, p_warehouse_location_id, p_posting_date,
    p_quantity_change, v_cost,
    case when p_quantity_change > 0 then v_amount else -v_amount end,
    v_new_qty, v_new_value
  );

  insert into public.inventory_levels (
    org_id, stock_item_id, warehouse_location_id, quantity_on_hand,
    quantity_reserved, quantity_available, last_counted, updated_at, is_deleted
  ) values (
    p_org_id, p_stock_item_id, p_warehouse_location_id, v_new_qty,
    0, v_new_qty, now(), now(), false
  )
  on conflict (org_id, stock_item_id, warehouse_location_id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    quantity_available = excluded.quantity_on_hand - coalesce(public.inventory_levels.quantity_reserved, 0),
    updated_at = now(), is_deleted = false;

  if p_transaction_type = 'OPENING_INVENTORY' then
    v_debit_account := v_class.inventory_asset_account_id;
    v_credit_account := v_class.opening_balance_equity_account_id;
  elsif p_transaction_type = 'INVENTORY_WRITEOFF' then
    v_debit_account := v_class.write_off_account_id;
    v_credit_account := v_class.inventory_asset_account_id;
  elsif p_quantity_change > 0 then
    v_debit_account := v_class.inventory_asset_account_id;
    v_credit_account := v_class.adjustment_account_id;
  else
    v_debit_account := v_class.adjustment_account_id;
    v_credit_account := v_class.inventory_asset_account_id;
  end if;
  if v_debit_account is null or v_credit_account is null then
    raise exception 'Inventory Class GL mapping is incomplete for %', p_transaction_type;
  end if;

  insert into public.journal_entries (
    org_id, period_id, date, description, reference, status, created_by,
    source_type, created_at, approved_by, approved_at, source_ref
  ) values (
    p_org_id, 'CURRENT', p_posting_date, coalesce(p_reason, p_transaction_type),
    v_reference, 'POSTED', p_actor_id, 'INVENTORY', now(), p_actor_id, now(), v_transaction_id
  ) returning id into v_journal_id;

  insert into public.journal_lines (
    journal_entry_id, account_id, debit, credit, memo, item_id, description
  ) values
    (v_journal_id, v_debit_account, v_amount, 0, p_reason, p_stock_item_id, p_transaction_type),
    (v_journal_id, v_credit_account, 0, v_amount, p_reason, p_stock_item_id, p_transaction_type);

  update public.inventory_transactions
  set status = 'POSTED', journal_entry_id = v_journal_id
  where id = v_transaction_id;

  return jsonb_build_object(
    'transactionId', v_transaction_id, 'referenceNumber', v_reference,
    'journalEntryId', v_journal_id, 'quantityOnHand', v_new_qty,
    'inventoryValue', v_new_value
  );
end;
$$;

revoke all on function public.post_inventory_movement(
  uuid,uuid,uuid,text,numeric,numeric,date,text,text,text,uuid,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.post_inventory_movement(
  uuid,uuid,uuid,text,numeric,numeric,date,text,text,text,uuid,text,text,uuid
) to service_role;

-- The legacy adjustment trigger directly changed stock levels and is superseded
-- by the posting engine above.
drop trigger if exists sync_approved_stock_adjustment on public.stock_adjustments;

alter table public.stock_adjustments
  drop constraint if exists stock_adjustments_adjustment_type_check;
alter table public.stock_adjustments
  add constraint stock_adjustments_adjustment_type_check check (
    adjustment_type in (
      'OPENING_INVENTORY','PHYSICAL_COUNT','DAMAGE','DAMAGED','LOST','EXPIRED',
      'SHRINKAGE','WRITEOFF','ADJUSTMENT','CORRECTION'
    )
  );

create or replace function public.post_stock_adjustment(
  p_org_id uuid,
  p_stock_item_id uuid,
  p_warehouse_location_id uuid,
  p_adjustment_type text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_posting_date date,
  p_reason text,
  p_notes text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_adjustment_id uuid;
  v_adjustment_number text;
  v_quantity_change numeric;
  v_transaction_type text;
  v_posting jsonb;
begin
  if p_quantity <= 0 then raise exception 'Adjustment quantity must be greater than zero'; end if;
  v_adjustment_number := concat('ADJ-', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'));
  if p_adjustment_type in ('DAMAGE','DAMAGED','LOST','EXPIRED','SHRINKAGE','WRITEOFF') then
    v_quantity_change := -abs(p_quantity);
    v_transaction_type := 'INVENTORY_WRITEOFF';
  elsif p_adjustment_type = 'OPENING_INVENTORY' then
    v_quantity_change := abs(p_quantity);
    v_transaction_type := 'OPENING_INVENTORY';
  elsif p_adjustment_type = 'PHYSICAL_COUNT' then
    v_quantity_change := p_quantity;
    v_transaction_type := 'CYCLE_COUNT_ADJUSTMENT';
  else
    v_quantity_change := p_quantity;
    v_transaction_type := 'STOCK_ADJUSTMENT';
  end if;

  insert into public.stock_adjustments (
    org_id, adjustment_number, stock_item_id, warehouse_location_id,
    quantity_change, adjustment_type, reason, notes, approved_by,
    approval_date, created_by, created_at, is_deleted
  ) values (
    p_org_id, v_adjustment_number, p_stock_item_id, p_warehouse_location_id,
    v_quantity_change, p_adjustment_type, p_reason, p_notes, p_actor_id,
    now(), p_actor_id, now(), false
  ) returning id into v_adjustment_id;

  v_posting := public.post_inventory_movement(
    p_org_id, p_stock_item_id, p_warehouse_location_id, v_transaction_type,
    v_quantity_change, p_unit_cost, p_posting_date, v_adjustment_number,
    'STOCK_ADJUSTMENT', p_reason, p_actor_id, null, null, null
  );

  update public.stock_adjustments
  set journal_entry_id = (v_posting->>'journalEntryId')::uuid
  where id = v_adjustment_id;

  return v_posting || jsonb_build_object(
    'adjustmentId', v_adjustment_id,
    'adjustmentNumber', v_adjustment_number
  );
end;
$$;

revoke all on function public.post_stock_adjustment(
  uuid,uuid,uuid,text,numeric,numeric,date,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.post_stock_adjustment(
  uuid,uuid,uuid,text,numeric,numeric,date,text,text,uuid
) to service_role;

create or replace function public.post_opening_inventory(
  p_org_id uuid,
  p_document_number text,
  p_posting_date date,
  p_remarks text,
  p_actor_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_header_id uuid;
  v_line jsonb;
  v_posting jsonb;
  v_first_journal uuid;
  v_count integer := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Opening inventory requires at least one line';
  end if;
  insert into public.opening_inventory_headers (
    org_id, document_number, posting_date, status, remarks,
    created_by, created_at, posted_by, posted_at
  ) values (
    p_org_id, p_document_number, p_posting_date, 'DRAFT', p_remarks,
    p_actor_id, now(), p_actor_id, now()
  ) returning id into v_header_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.opening_inventory_lines (
      header_id, warehouse_location_id, stock_item_id, quantity, unit_cost,
      batch_lot, expiration_date, remarks
    ) values (
      v_header_id,
      (v_line->>'warehouseLocationId')::uuid,
      (v_line->>'stockItemId')::uuid,
      (v_line->>'quantity')::numeric,
      (v_line->>'unitCost')::numeric,
      nullif(v_line->>'batchLot',''),
      nullif(v_line->>'expirationDate','')::date,
      nullif(v_line->>'remarks','')
    );
    v_posting := public.post_inventory_movement(
      p_org_id,
      (v_line->>'stockItemId')::uuid,
      (v_line->>'warehouseLocationId')::uuid,
      'OPENING_INVENTORY',
      (v_line->>'quantity')::numeric,
      (v_line->>'unitCost')::numeric,
      p_posting_date,
      p_document_number,
      'OPENING_INVENTORY',
      coalesce(nullif(v_line->>'remarks',''), p_remarks, 'Opening inventory'),
      p_actor_id,
      nullif(v_line->>'batchLot',''),
      null,
      null
    );
    v_first_journal := coalesce(v_first_journal, (v_posting->>'journalEntryId')::uuid);
    v_count := v_count + 1;
  end loop;

  update public.opening_inventory_headers
  set status = 'POSTED', journal_entry_id = v_first_journal
  where id = v_header_id;

  return jsonb_build_object(
    'headerId', v_header_id, 'documentNumber', p_document_number,
    'status', 'POSTED', 'lineCount', v_count, 'journalEntryId', v_first_journal
  );
end;
$$;

revoke all on function public.post_opening_inventory(uuid,text,date,text,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.post_opening_inventory(uuid,text,date,text,uuid,jsonb)
  to service_role;
