alter table public.company_customers
  add column if not exists customer_type text not null default '';
alter table public.company_customers
  add column if not exists sales_rep text not null default '';
