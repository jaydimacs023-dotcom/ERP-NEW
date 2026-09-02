alter table if exists public.invoice_lines
  add column if not exists line_type text not null default 'MANUAL';

alter table if exists public.invoice_lines
  drop constraint if exists invoice_lines_line_type_check;

alter table if exists public.invoice_lines
  add constraint invoice_lines_line_type_check
  check (line_type in ('COURSE_FEE', 'DISCOUNT', 'ADJUSTMENT', 'MANUAL'));

create index if not exists idx_invoice_lines_line_type
  on public.invoice_lines(line_type);
