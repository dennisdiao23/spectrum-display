-- Close the public Data API hole on company staff roles.
-- The Node app uses the service role key, which bypasses RLS.

alter table public.admin_roles enable row level security;

drop policy if exists admin_roles_admin_all on public.admin_roles;
create policy admin_roles_admin_all on public.admin_roles
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

revoke all on public.admin_roles from anon, authenticated, public;
grant all on public.admin_roles to service_role;
