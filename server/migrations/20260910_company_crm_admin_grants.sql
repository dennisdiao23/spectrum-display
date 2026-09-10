-- Company talks to Supabase with the anon key plus x-spectrum-admin.
-- company_crm_v1 enabled RLS and left only service_role grants, so Save lead
-- failed with "permission denied for table company_crm_leads".
-- Match Customer: staff access via is_spectrum_admin().

alter table public.company_crm_leads enable row level security;
alter table public.company_crm_deals enable row level security;
alter table public.company_crm_activities enable row level security;

drop policy if exists company_crm_leads_admin_all on public.company_crm_leads;
create policy company_crm_leads_admin_all on public.company_crm_leads
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists company_crm_deals_admin_all on public.company_crm_deals;
create policy company_crm_deals_admin_all on public.company_crm_deals
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists company_crm_activities_admin_all on public.company_crm_activities;
create policy company_crm_activities_admin_all on public.company_crm_activities
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant select, insert, update, delete on table public.company_crm_leads to anon, authenticated;
grant select, insert, update, delete on table public.company_crm_deals to anon, authenticated;
grant select, insert, update, delete on table public.company_crm_activities to anon, authenticated;

grant all on table public.company_crm_leads to service_role;
grant all on table public.company_crm_deals to service_role;
grant all on table public.company_crm_activities to service_role;

grant usage, select on sequence public.company_crm_leads_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.company_crm_deals_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.company_crm_activities_id_seq to anon, authenticated, service_role;
