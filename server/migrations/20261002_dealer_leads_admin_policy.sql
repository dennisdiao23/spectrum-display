-- Staff send leads through the website with the anon key plus x-spectrum-admin.
-- dealer_leads had the lock on and no staff policy, so Send failed with
-- "new row violates row-level security policy".
-- Same staff key as company_crm_leads. Dealers do not query this table.

drop policy if exists dealer_leads_admin_all on public.dealer_leads;
create policy dealer_leads_admin_all on public.dealer_leads
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
