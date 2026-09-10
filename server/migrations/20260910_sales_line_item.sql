alter table public.company_sales_lines
  add column if not exists item text not null default '';

notify pgrst, 'reload schema';
