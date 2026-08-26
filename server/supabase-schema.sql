-- Spectrum Display — run this once in the Supabase SQL editor
-- Dashboard → SQL Editor → New query → Run

create table if not exists public.brands (
  id text primary key,
  name text not null,
  tagline text not null default ''
);

create table if not exists public.products (
  id bigint generated always as identity primary key,
  brand_id text not null references public.brands(id) on delete cascade,
  series_id text not null,
  name text not null,
  pitches jsonb not null default '[]'::jsonb,
  price_per_m2 double precision not null default 0,
  weight_per_m2 double precision not null default 0,
  power_avg double precision not null default 0,
  power_max double precision not null default 0,
  cabinet_w double precision not null default 0.5,
  cabinet_h double precision not null default 0.5,
  type text not null default 'Fixed',
  description text not null default '',
  badge text not null default '',
  image text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, series_id)
);

create table if not exists public.admins (
  id bigint generated always as identity primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  token text primary key,
  admin_id bigint not null references public.admins(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists products_brand_idx on public.products (brand_id, sort_order, name);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.admins enable row level security;
alter table public.sessions enable row level security;

drop policy if exists brands_public_read on public.brands;
create policy brands_public_read on public.brands for select using (true);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (true);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
on storage.objects for select
using (bucket_id = 'product-images');

create table if not exists public.contact_inquiries (
  id bigint generated always as identity primary key,
  name text not null,
  company text not null default '',
  email text not null,
  phone text not null default '',
  project_type text not null default '',
  message text not null default '',
  created_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;

drop policy if exists contact_inquiries_admin_all on public.contact_inquiries;
create policy contact_inquiries_admin_all
on public.contact_inquiries
for all
using (public.is_spectrum_admin())
with check (public.is_spectrum_admin());

grant select, insert on public.contact_inquiries to anon, authenticated;
grant all on public.contact_inquiries to service_role;

-- Site accounts (Supabase Auth users). Role is always customer unless Admin changes it.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default '',
  role text not null default 'customer',
  company text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null default '',
  brand_name text not null default '',
  series text not null default '',
  series_name text not null default '',
  pitch double precision,
  width double precision,
  height double precision,
  cabinets integer,
  designer_url text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_panels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  w double precision,
  h double precision,
  pitch double precision,
  type text not null default 'Custom',
  weight double precision,
  price double precision,
  pavg double precision,
  pmax double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_id text not null,
  date date not null default current_date,
  status text not null default 'Processing',
  total double precision not null default 0,
  items jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.saved_projects enable row level security;
alter table public.custom_panels enable row level security;
alter table public.orders enable row level security;

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
for all
using (public.is_spectrum_admin())
with check (public.is_spectrum_admin());

drop policy if exists saved_projects_admin_all on public.saved_projects;
create policy saved_projects_admin_all on public.saved_projects
for all
using (public.is_spectrum_admin())
with check (public.is_spectrum_admin());

drop policy if exists custom_panels_admin_all on public.custom_panels;
create policy custom_panels_admin_all on public.custom_panels
for all
using (public.is_spectrum_admin())
with check (public.is_spectrum_admin());

drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders
for all
using (public.is_spectrum_admin())
with check (public.is_spectrum_admin());

grant select, insert, update, delete on public.saved_projects to anon, authenticated;
grant select, insert, update, delete on public.custom_panels to anon, authenticated;

-- New Auth users get a Customer profile. tg_op is 'INSERT' (uppercase);
-- comparing to 'insert' made the UPDATE branch run, copying OLD.role (null)
-- onto the new row and breaking Google / email signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.role is null or new.role not in ('customer', 'dealer', 'sales') then
    new.role := 'customer';
  end if;
  if tg_op = 'INSERT' then
    if not public.is_spectrum_admin() then
      new.role := 'customer';
    end if;
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_spectrum_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
before insert or update on public.profiles
for each row execute function public.guard_profile_role();

-- Admin-only markup %. Customers never read these tables; they get a multiplier via RPC.
create table if not exists public.price_tiers (
  role text primary key check (role in ('customer', 'dealer', 'sales')),
  markup_pct double precision not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.price_tiers (role, markup_pct)
values ('customer', 0), ('dealer', 0), ('sales', 0)
on conflict (role) do nothing;

create table if not exists public.account_price_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  markup_pct double precision not null,
  updated_at timestamptz not null default now()
);

alter table public.price_tiers enable row level security;
alter table public.account_price_overrides enable row level security;

drop policy if exists price_tiers_admin_all on public.price_tiers;
create policy price_tiers_admin_all on public.price_tiers
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists account_price_overrides_admin_all on public.account_price_overrides;
create policy account_price_overrides_admin_all on public.account_price_overrides
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant select, insert, update, delete on public.price_tiers to anon, authenticated;
grant select, insert, update, delete on public.account_price_overrides to anon, authenticated;
grant all on public.price_tiers to service_role;
grant all on public.account_price_overrides to service_role;

create or replace function public.my_price_multiplier()
returns double precision
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  uid uuid := auth.uid();
  r text;
  pct double precision;
begin
  if uid is null then
    return 1;
  end if;
  select markup_pct into pct
  from public.account_price_overrides
  where user_id = uid;
  if found then
    return 1 + coalesce(pct, 0) / 100.0;
  end if;
  select role into r from public.profiles where id = uid;
  r := coalesce(r, 'customer');
  if r not in ('customer', 'dealer', 'sales') then
    r := 'customer';
  end if;
  select markup_pct into pct from public.price_tiers where role = r;
  return 1 + coalesce(pct, 0) / 100.0;
end;
$fn$;

revoke all on function public.my_price_multiplier() from public;
grant execute on function public.my_price_multiplier() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dealer portal step 1: companies + pending_dealer (also applied via migration)
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null default '',
  website text not null default '',
  phone text not null default '',
  billing_email text not null default '',
  tax_id text not null default '',
  resale_certificate_url text not null default '',
  billing_address jsonb not null default '{}'::jsonb,
  default_ship_address jsonb not null default '{}'::jsonb,
  extra_ship_addresses jsonb not null default '[]'::jsonb,
  account_type text not null default 'pending_dealer'
    check (account_type in ('customer', 'pending_dealer', 'dealer')),
  dealer_tier text not null default 'authorized'
    check (dealer_tier in ('authorized', 'preferred', 'elite')),
  price_book_id uuid,
  payment_terms text not null default 'prepaid_30_70'
    check (payment_terms in ('prepaid_30_70', 'net15', 'net30')),
  deposit_required boolean not null default true,
  hold_hours integer not null default 48,
  terms_eligible boolean not null default false,
  paid_order_count integer not null default 0,
  lifetime_paid_usd numeric not null default 0,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'rejected')),
  application jsonb not null default '{}'::jsonb,
  notes_internal text not null default '',
  approved_at timestamptz,
  approved_by_admin_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table public.profiles
  add column if not exists dealer_role text
    check (dealer_role is null or dealer_role in ('admin', 'sales', 'purchasing', 'tech'));

alter table public.companies enable row level security;

drop policy if exists companies_select_own on public.companies;
create policy companies_select_own on public.companies
for select
to authenticated
using (
  id in (select company_id from public.profiles where id = auth.uid())
  or public.is_spectrum_admin()
);

grant select on public.companies to authenticated;
grant all on public.companies to service_role;
