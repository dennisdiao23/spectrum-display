-- Role Setting talks to Supabase with the anon key plus x-spectrum-admin.
-- RLS still requires is_spectrum_admin(). Privileges on admin_roles must
-- match admins / sessions or GET /api/admin/roles fails with
-- "Could not read admin roles."

grant select, insert, update, delete on table public.admin_roles to anon, authenticated;
grant all on table public.admin_roles to service_role;
