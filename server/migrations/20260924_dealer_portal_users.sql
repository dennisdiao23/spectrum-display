create table if not exists public.dealer_users (
  id bigint generated always as identity primary key,
  email text not null unique,
  name text not null default '',
  password_hash text not null,
  customer_id bigint,
  application_id bigint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dealer_sessions (
  token text primary key,
  dealer_user_id bigint not null references public.dealer_users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.dealer_files (
  id bigint generated always as identity primary key,
  customer_id bigint not null,
  dealer_user_id bigint,
  name text not null default '',
  url text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.dealer_projects (
  id bigint generated always as identity primary key,
  customer_id bigint not null,
  dealer_user_id bigint,
  title text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dealer_custom_panels (
  id bigint generated always as identity primary key,
  customer_id bigint not null,
  dealer_user_id bigint,
  name text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dealer_users enable row level security;
alter table public.dealer_sessions enable row level security;
alter table public.dealer_files enable row level security;
alter table public.dealer_projects enable row level security;
alter table public.dealer_custom_panels enable row level security;
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
grant all on public.dealer_users to service_role;
grant all on public.dealer_sessions to service_role;
grant all on public.dealer_files to service_role;
grant all on public.dealer_projects to service_role;
grant all on public.dealer_custom_panels to service_role;
grant usage, select on sequence public.dealer_users_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.dealer_files_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.dealer_projects_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.dealer_custom_panels_id_seq to anon, authenticated, service_role;
