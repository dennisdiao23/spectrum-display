-- Company talks to Supabase with the anon key plus x-spectrum-admin.
-- dealer_users had row level security on and no policy, so Create portal login
-- failed with "new row violates row-level security policy for table dealer_users".
-- Match dealer applications: staff access via is_spectrum_admin().

drop policy if exists dealer_users_admin_all on public.dealer_users;
create policy dealer_users_admin_all on public.dealer_users
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists dealer_sessions_admin_all on public.dealer_sessions;
create policy dealer_sessions_admin_all on public.dealer_sessions
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists dealer_files_admin_all on public.dealer_files;
create policy dealer_files_admin_all on public.dealer_files
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists dealer_projects_admin_all on public.dealer_projects;
create policy dealer_projects_admin_all on public.dealer_projects
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists dealer_custom_panels_admin_all on public.dealer_custom_panels;
create policy dealer_custom_panels_admin_all on public.dealer_custom_panels
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant select, insert, update, delete on table public.dealer_users to anon, authenticated;
grant select, insert, update, delete on table public.dealer_sessions to anon, authenticated;
grant select, insert, update, delete on table public.dealer_files to anon, authenticated;
grant select, insert, update, delete on table public.dealer_projects to anon, authenticated;
grant select, insert, update, delete on table public.dealer_custom_panels to anon, authenticated;

grant all on table public.dealer_users to service_role;
grant all on table public.dealer_sessions to service_role;
grant all on table public.dealer_files to service_role;
grant all on table public.dealer_projects to service_role;
grant all on table public.dealer_custom_panels to service_role;

grant usage, select on sequence public.dealer_users_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.dealer_files_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.dealer_projects_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.dealer_custom_panels_id_seq to anon, authenticated, service_role;
