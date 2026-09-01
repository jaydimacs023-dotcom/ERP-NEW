-- Inventory-only posting controls: open-period resolution, exact-cost reversals,
-- idempotent reversal links, and supporting indexes. Existing public function
-- names and parameters are preserved.

create index if not exists inventory_transactions_reversal_lookup_idx
  on public.inventory_transactions(org_id, reversal_of_id)
  where reversal_of_id is not null and status = 'POSTED';

alter table public.stock_adjustments
  add column if not exists reversed_by uuid references public.users(id),
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_transaction_id uuid references public.inventory_transactions(id),
  add column if not exists request_id uuid;

create unique index if not exists stock_adjustments_org_request_id_idx
  on public.stock_adjustments(org_id, request_id)
  where request_id is not null;

create or replace function private.protect_posted_stock_adjustment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if old.approval_date is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Posted stock adjustments cannot be deleted; create a reversal instead';
  end if;
  if current_user <> 'service_role' and (
    new.journal_entry_id is distinct from old.journal_entry_id
    or new.reversed_by is distinct from old.reversed_by
    or new.reversed_at is distinct from old.reversed_at
    or new.reversal_transaction_id is distinct from old.reversal_transaction_id
    or new.request_id is distinct from old.request_id
  ) then
    raise exception 'Only the Inventory posting service may update posting metadata';
  end if;
  if (to_jsonb(new) - 'journal_entry_id' - 'reversed_by' - 'reversed_at' - 'reversal_transaction_id' - 'request_id')
     is distinct from
     (to_jsonb(old) - 'journal_entry_id' - 'reversed_by' - 'reversed_at' - 'reversal_transaction_id' - 'request_id') then
    raise exception 'Posted stock adjustments are immutable; create a reversal instead';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_posted_stock_adjustment on public.stock_adjustments;
create trigger protect_posted_stock_adjustment
before update or delete on public.stock_adjustments
for each row execute function private.protect_posted_stock_adjustment();

create unique index if not exists opening_inventory_lines_unique_item_warehouse_idx
  on public.opening_inventory_lines(header_id, stock_item_id, warehouse_location_id);

create or replace function private.validate_opening_inventory_line()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_org_id uuid;
begin
  select header.org_id into v_org_id
  from public.opening_inventory_headers header
  where header.id = new.header_id;
  if v_org_id is null then raise exception 'Opening Inventory header was not found'; end if;
  if exists (
    select 1 from public.inventory_ledger ledger
    where ledger.org_id = v_org_id
      and ledger.stock_item_id = new.stock_item_id
      and ledger.warehouse_location_id = new.warehouse_location_id
  ) then
    raise exception 'Opening Inventory already has ledger history for this item and warehouse; use Count & Adjust instead';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_opening_inventory_line on public.opening_inventory_lines;
create trigger validate_opening_inventory_line
before insert on public.opening_inventory_lines
for each row execute function private.validate_opening_inventory_line();

create index if not exists accounting_periods_inventory_posting_idx
  on public.accounting_periods(org_id, start_date, end_date)
  where status = 'OPEN' and not coalesce(is_deleted, false);

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
  v_period_id uuid;
  v_next_open_date date;
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
  v_original_transaction_type text;
begin
  if p_quantity_change = 0 then raise exception 'Inventory quantity change cannot be zero'; end if;
  if p_posting_date is null then raise exception 'Posting date is required'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Reason is required'; end if;

  select period.id into v_period_id
  from public.accounting_periods period
  where period.org_id = p_org_id
    and period.status = 'OPEN'
    and p_posting_date between period.start_date and period.end_date
    and not coalesce(period.is_deleted, false)
  order by period.start_date desc
  limit 1;
  if v_period_id is null then
    select min(period.start_date) into v_next_open_date
    from public.accounting_periods period
    where period.org_id = p_org_id
      and period.status = 'OPEN'
      and period.start_date > p_posting_date
      and not coalesce(period.is_deleted, false);
    if v_next_open_date is not null then
      raise exception 'Posting date % is not in an open accounting period. The next open period begins on %', p_posting_date, v_next_open_date;
    end if;
    raise exception 'No open accounting period exists for posting date %', p_posting_date;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_org_id::text || ':' || p_stock_item_id::text || ':' || p_warehouse_location_id::text, 0
  ));

  if p_reversal_of_id is not null then
    select source.transaction_type into v_original_transaction_type
      from public.inventory_transactions source
      where source.id = p_reversal_of_id
        and source.org_id = p_org_id
        and source.stock_item_id = p_stock_item_id
        and source.status = 'POSTED'
        and not coalesce(source.is_deleted, false);
    if v_original_transaction_type is null then
      raise exception 'Original posted Inventory transaction was not found in this organization';
    end if;
    if exists (
      select 1 from public.inventory_transactions reversal
      where reversal.org_id = p_org_id
        and reversal.reversal_of_id = p_reversal_of_id
        and reversal.status = 'POSTED'
        and not coalesce(reversal.is_deleted, false)
    ) then
      raise exception 'This Inventory transaction has already been reversed';
    end if;
  end if;

  select * into v_item from public.stock_items
  where id = p_stock_item_id and org_id = p_org_id and not coalesce(is_deleted, false);
  if not found then raise exception 'Stock item not found in organization'; end if;
  if v_item.inventory_class_id is null then raise exception 'Stock item requires an Inventory Class before posting'; end if;

  select * into v_class from public.inventory_classes
  where id = v_item.inventory_class_id and org_id = p_org_id and is_active;
  if not found then raise exception 'Active Inventory Class not found'; end if;

  if not exists (
    select 1 from public.warehouse_locations warehouse
    where warehouse.id = p_warehouse_location_id
      and warehouse.org_id = p_org_id
      and warehouse.is_active
      and not coalesce(warehouse.is_deleted, false)
  ) then
    raise exception 'Active warehouse not found in organization';
  end if;

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
  if p_reversal_of_id is not null then
    v_cost := coalesce(p_unit_cost, 0);
  elsif p_quantity_change < 0 and v_current_qty > 0
     and coalesce(v_item.valuation_method_override, v_class.valuation_method) = 'WEIGHTED_AVERAGE' then
    v_cost := round(v_current_value / v_current_qty, 4);
  else
    v_cost := coalesce(nullif(p_unit_cost, 0), v_item.standard_cost, 0);
  end if;
  if v_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;

  v_amount := round(abs(p_quantity_change) * v_cost, 4);
  v_new_qty := v_current_qty + p_quantity_change;
  if v_new_qty < 0 then
    raise exception 'Insufficient stock: available %, requested %', v_current_qty, abs(p_quantity_change);
  end if;
  v_new_value := v_current_value + case when p_quantity_change > 0 then v_amount else -v_amount end;

  v_reference := concat(
    case when p_reversal_of_id is null then 'INV-' else 'REV-' end,
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), '-', upper(substr(gen_random_uuid()::text, 1, 6))
  );

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
    0, v_new_qty, p_posting_date,
    now(), false
  )
  on conflict (org_id, stock_item_id, warehouse_location_id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    quantity_available = excluded.quantity_on_hand - coalesce(public.inventory_levels.quantity_reserved, 0),
    last_counted = case when p_transaction_type = 'CYCLE_COUNT_ADJUSTMENT'
      then excluded.last_counted else public.inventory_levels.last_counted end,
    updated_at = now(), is_deleted = false;

  if p_reversal_of_id is not null and v_original_transaction_type = 'INVENTORY_WRITEOFF' then
    v_debit_account := v_class.inventory_asset_account_id;
    v_credit_account := v_class.write_off_account_id;
  elsif p_transaction_type = 'OPENING_INVENTORY' then
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
  if not exists (
    select 1 from public.chart_of_accounts account
    where account.id = v_debit_account and account.org_id = p_org_id
      and account.is_active and not account.is_header
  ) or not exists (
    select 1 from public.chart_of_accounts account
    where account.id = v_credit_account and account.org_id = p_org_id
      and account.is_active and not account.is_header
  ) then
    raise exception 'Inventory Class contains an invalid or inactive GL account';
  end if;

  insert into public.journal_entries (
    org_id, period_id, date, description, reference, status, created_by,
    source_type, created_at, approved_by, approved_at, source_ref, original_entry_id, reversal_reason
  ) values (
    p_org_id, v_period_id, p_posting_date, coalesce(p_reason, p_transaction_type),
    v_reference, 'POSTED', p_actor_id,
    case when p_reversal_of_id is null then 'INVENTORY' else 'REVERSAL' end,
    now(), p_actor_id, now(), v_transaction_id,
    case when p_reversal_of_id is null then null else (
      select journal_entry_id from public.inventory_transactions where id = p_reversal_of_id
    ) end,
    case when p_reversal_of_id is null then null else p_reason end
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
    'inventoryValue', v_new_value, 'periodId', v_period_id
  );
end;
$$;

revoke all on function public.post_inventory_movement(
  uuid,uuid,uuid,text,numeric,numeric,date,text,text,text,uuid,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.post_inventory_movement(
  uuid,uuid,uuid,text,numeric,numeric,date,text,text,text,uuid,text,text,uuid
) to service_role;

create or replace function public.post_inventory_count(
  p_org_id uuid,
  p_stock_item_id uuid,
  p_warehouse_location_id uuid,
  p_expected_quantity numeric,
  p_counted_quantity numeric,
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
  v_current_quantity numeric(18,4);
  v_quantity_change numeric(18,4);
  v_adjustment_id uuid;
  v_adjustment_number text;
  v_posting jsonb;
begin
  if p_counted_quantity < 0 then raise exception 'Counted quantity cannot be negative'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_org_id::text || ':' || p_stock_item_id::text || ':' || p_warehouse_location_id::text, 0
  ));

  select coalesce(ledger.running_quantity, 0) into v_current_quantity
  from public.inventory_ledger ledger
  where ledger.org_id = p_org_id
    and ledger.stock_item_id = p_stock_item_id
    and ledger.warehouse_location_id = p_warehouse_location_id
  order by ledger.id desc limit 1;
  v_current_quantity := coalesce(v_current_quantity, 0);

  if v_current_quantity <> p_expected_quantity then
    raise exception 'Stock changed while this count was being reviewed. Current quantity is %; refresh and review the count again.', v_current_quantity;
  end if;

  v_quantity_change := p_counted_quantity - v_current_quantity;
  if v_quantity_change = 0 then raise exception 'The counted quantity matches the system quantity; no adjustment is required'; end if;

  v_adjustment_number := concat('COUNT-', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'));
  insert into public.stock_adjustments (
    org_id, adjustment_number, stock_item_id, warehouse_location_id,
    quantity_change, adjustment_type, reason, notes, approved_by,
    approval_date, created_by, created_at, is_deleted
  ) values (
    p_org_id, v_adjustment_number, p_stock_item_id, p_warehouse_location_id,
    v_quantity_change, 'PHYSICAL_COUNT', p_reason, p_notes, p_actor_id,
    now(), p_actor_id, now(), false
  ) returning id into v_adjustment_id;

  v_posting := public.post_inventory_movement(
    p_org_id, p_stock_item_id, p_warehouse_location_id,
    'CYCLE_COUNT_ADJUSTMENT', v_quantity_change, 0, p_posting_date,
    v_adjustment_number, 'STOCK_ADJUSTMENT', p_reason, p_actor_id,
    null, null, null
  );

  update public.stock_adjustments
  set journal_entry_id = (v_posting->>'journalEntryId')::uuid
  where id = v_adjustment_id;

  return v_posting || jsonb_build_object(
    'adjustmentId', v_adjustment_id,
    'adjustmentNumber', v_adjustment_number,
    'countedQuantity', p_counted_quantity,
    'quantityChange', v_quantity_change
  );
end;
$$;

revoke all on function public.post_inventory_count(uuid,uuid,uuid,numeric,numeric,date,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.post_inventory_count(uuid,uuid,uuid,numeric,numeric,date,text,text,uuid)
  to service_role;

create or replace function public.post_stock_adjustment_idempotent(
  p_org_id uuid,
  p_stock_item_id uuid,
  p_warehouse_location_id uuid,
  p_adjustment_type text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_posting_date date,
  p_reason text,
  p_notes text,
  p_actor_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_existing public.stock_adjustments%rowtype;
  v_posting jsonb;
begin
  if p_request_id is null then raise exception 'Inventory request id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':inventory-request:' || p_request_id::text, 0));
  select * into v_existing from public.stock_adjustments
  where org_id = p_org_id and request_id = p_request_id and not coalesce(is_deleted, false);
  if found then
    return jsonb_build_object(
      'adjustmentId', v_existing.id,
      'adjustmentNumber', v_existing.adjustment_number,
      'journalEntryId', v_existing.journal_entry_id,
      'idempotent', true
    );
  end if;
  v_posting := public.post_stock_adjustment(
    p_org_id, p_stock_item_id, p_warehouse_location_id, p_adjustment_type,
    p_quantity, p_unit_cost, p_posting_date, p_reason, p_notes, p_actor_id
  );
  update public.stock_adjustments set request_id = p_request_id
  where id = (v_posting->>'adjustmentId')::uuid;
  return v_posting || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.post_stock_adjustment_idempotent(uuid,uuid,uuid,text,numeric,numeric,date,text,text,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.post_stock_adjustment_idempotent(uuid,uuid,uuid,text,numeric,numeric,date,text,text,uuid,uuid)
  to service_role;

create or replace function public.post_inventory_count_idempotent(
  p_org_id uuid,
  p_stock_item_id uuid,
  p_warehouse_location_id uuid,
  p_expected_quantity numeric,
  p_counted_quantity numeric,
  p_posting_date date,
  p_reason text,
  p_notes text,
  p_actor_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_existing public.stock_adjustments%rowtype;
  v_posting jsonb;
begin
  if p_request_id is null then raise exception 'Inventory request id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':inventory-request:' || p_request_id::text, 0));
  select * into v_existing from public.stock_adjustments
  where org_id = p_org_id and request_id = p_request_id and not coalesce(is_deleted, false);
  if found then
    return jsonb_build_object(
      'adjustmentId', v_existing.id,
      'adjustmentNumber', v_existing.adjustment_number,
      'journalEntryId', v_existing.journal_entry_id,
      'idempotent', true
    );
  end if;
  v_posting := public.post_inventory_count(
    p_org_id, p_stock_item_id, p_warehouse_location_id, p_expected_quantity,
    p_counted_quantity, p_posting_date, p_reason, p_notes, p_actor_id
  );
  update public.stock_adjustments set request_id = p_request_id
  where id = (v_posting->>'adjustmentId')::uuid;
  return v_posting || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.post_inventory_count_idempotent(uuid,uuid,uuid,numeric,numeric,date,text,text,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.post_inventory_count_idempotent(uuid,uuid,uuid,numeric,numeric,date,text,text,uuid,uuid)
  to service_role;

create or replace function public.reverse_inventory_adjustment(
  p_org_id uuid,
  p_adjustment_id uuid,
  p_reversal_date date,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_adjustment public.stock_adjustments%rowtype;
  v_original public.inventory_transactions%rowtype;
  v_posting jsonb;
begin
  if p_reversal_date is null then raise exception 'Reversal date is required'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Reversal reason is required'; end if;

  select * into v_adjustment
  from public.stock_adjustments adjustment
  where adjustment.id = p_adjustment_id
    and adjustment.org_id = p_org_id
    and adjustment.approval_date is not null
    and adjustment.journal_entry_id is not null
    and adjustment.reversed_at is null
    and not coalesce(adjustment.is_deleted, false)
  for update;
  if not found then raise exception 'Posted stock adjustment was not found in organization'; end if;

  select * into v_original
  from public.inventory_transactions tx
  where tx.org_id = p_org_id
    and tx.journal_entry_id = v_adjustment.journal_entry_id
    and tx.status = 'POSTED'
    and not coalesce(tx.is_deleted, false)
  limit 1;
  if not found then raise exception 'Original Inventory transaction was not found'; end if;

  v_posting := public.post_inventory_movement(
    p_org_id,
    v_original.stock_item_id,
    v_original.to_location_id,
    'REVERSAL',
    case
      when exists (
        select 1 from public.inventory_ledger ledger
        where ledger.transaction_id = v_original.id and ledger.quantity_change > 0
      ) then -v_original.quantity
      else v_original.quantity
    end,
    v_original.unit_cost,
    p_reversal_date,
    v_adjustment.adjustment_number,
    'STOCK_ADJUSTMENT_REVERSAL',
    p_reason,
    p_actor_id,
    v_original.batch_lot,
    v_original.serial_number,
    v_original.id
  );

  update public.stock_adjustments
  set reversed_by = p_actor_id,
      reversed_at = now(),
      reversal_transaction_id = (v_posting->>'transactionId')::uuid
  where id = v_adjustment.id;

  return v_posting || jsonb_build_object(
    'adjustmentId', v_adjustment.id,
    'originalTransactionId', v_original.id,
    'status', 'REVERSED'
  );
end;
$$;

revoke all on function public.reverse_inventory_adjustment(uuid,uuid,date,text,uuid)
  from public, anon, authenticated;
grant execute on function public.reverse_inventory_adjustment(uuid,uuid,date,text,uuid)
  to service_role;
