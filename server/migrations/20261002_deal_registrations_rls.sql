drop policy if exists deal_registrations_admin_all on public.deal_registrations;
create policy deal_registrations_admin_all on public.deal_registrations
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.deal_registrations to service_role;
