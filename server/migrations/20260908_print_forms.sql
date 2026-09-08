alter table public.company_sales_docs
  add column if not exists rep text not null default '',
  add column if not exists account_no text not null default '',
  add column if not exists ship_date text not null default '',
  add column if not exists ship_via text not null default '',
  add column if not exists tracking text not null default '',
  add column if not exists so_number text not null default '';

create table if not exists public.company_print_forms (
  type text primary key,
  template_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.company_print_forms enable row level security;
drop policy if exists company_print_forms_admin_all on public.company_print_forms;
create policy company_print_forms_admin_all on public.company_print_forms
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.company_print_forms to service_role;

notify pgrst, 'reload schema';
