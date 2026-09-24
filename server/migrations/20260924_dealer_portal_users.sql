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
grant all on public.dealer_users to service_role;
grant all on public.dealer_sessions to service_role;
grant all on public.dealer_files to service_role;
grant all on public.dealer_projects to service_role;
grant all on public.dealer_custom_panels to service_role;
