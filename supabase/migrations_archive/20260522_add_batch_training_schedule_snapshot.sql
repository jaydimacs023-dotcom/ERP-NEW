alter table public.batches
  add column if not exists training_schedule_slots jsonb;
