-- Close the public Data API hole on company staff roles.
-- RLS requires is_spectrum_admin() (x-spectrum-admin header).
-- The Node app uses the anon key, so anon/authenticated need table privileges
-- or Role Setting cannot read admin_roles.

alter table public.admin_roles enable row level security;

drop policy if exists admin_roles_admin_all on public.admin_roles;
create policy admin_roles_admin_all on public.admin_roles
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant select, insert, update, delete on table public.admin_roles to anon, authenticated;
grant all on table public.admin_roles to service_role;
