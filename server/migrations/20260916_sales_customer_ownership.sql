-- Sales ownership: manager hierarchy + customer sales rep id
alter table public.admins add column if not exists manager_id text not null default '';

alter table public.company_customers add column if not exists sales_rep_id text not null default '';

create index if not exists idx_admins_manager_id on public.admins(manager_id);
create index if not exists idx_company_customers_sales_rep_id on public.company_customers(sales_rep_id);
