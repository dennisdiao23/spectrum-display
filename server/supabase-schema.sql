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
  details jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, series_id)
);

alter table public.products add column if not exists hidden boolean not null default false;

create table if not exists public.admins (
  id bigint generated always as identity primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

alter table public.admins add column if not exists role text not null default 'owner';

create table if not exists public.admin_roles (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  website_access text not null default 'none',
  inventory_access text not null default 'none',
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.admin_roles (slug, name, website_access, inventory_access, locked)
values
  ('owner', 'Owner', 'edit', 'edit', true),
  ('website', 'Website', 'edit', 'view', false),
  ('inventory', 'Inventory', 'none', 'edit', false)
on conflict (slug) do nothing;

grant all on public.admin_roles to service_role;

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

-- Legacy catalog-tied stock (kept for one-time migration).
create table if not exists public.inventory_stock (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  pitch text not null default '',
  qty integer not null default 0,
  low_at integer not null default 8,
  updated_at timestamptz not null default now(),
  unique (product_id, pitch)
);

create table if not exists public.inventory_moves (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  pitch text not null default '',
  kind text not null,
  qty_delta integer not null,
  qty_after integer not null,
  note text not null default '',
  admin_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists inventory_stock_product_idx on public.inventory_stock (product_id);
create index if not exists inventory_moves_product_idx on public.inventory_moves (product_id, created_at desc);

alter table public.inventory_stock enable row level security;
alter table public.inventory_moves enable row level security;

drop policy if exists inventory_stock_admin_all on public.inventory_stock;
create policy inventory_stock_admin_all on public.inventory_stock
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists inventory_moves_admin_all on public.inventory_moves;
create policy inventory_moves_admin_all on public.inventory_moves
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.inventory_stock to service_role;
grant all on public.inventory_moves to service_role;

-- Independent inventory SKUs. Website products link to these via product_inventory_map.
create table if not exists public.inventory_items (
  id bigint generated always as identity primary key,
  sku text not null default '',
  name text not null,
  brand_id text not null default '',
  pitch text not null default '',
  unit text not null default 'panels',
  qty integer not null default 0,
  low_at integer not null default 8,
  price double precision not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items add column if not exists sku text not null default '';
alter table public.inventory_items add column if not exists description text not null default '';
alter table public.inventory_items add column if not exists cost double precision not null default 0;
alter table public.inventory_items add column if not exists dealer_net double precision not null default 0;
alter table public.inventory_items add column if not exists weight double precision not null default 0;
alter table public.inventory_items add column if not exists panel_w double precision not null default 0;
alter table public.inventory_items add column if not exists panel_h double precision not null default 0;
alter table public.inventory_items add column if not exists image text not null default '';
create unique index if not exists inventory_items_sku_uidx on public.inventory_items (sku);

create table if not exists public.inventory_item_moves (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  kind text not null,
  qty_delta integer not null,
  qty_after integer not null,
  note text not null default '',
  admin_email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.product_inventory_map (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  pitch text not null default '',
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  unique (product_id, pitch)
);

create index if not exists inventory_items_brand_idx on public.inventory_items (brand_id, name);
create index if not exists inventory_item_moves_item_idx on public.inventory_item_moves (item_id, created_at desc);
create index if not exists product_inventory_map_item_idx on public.product_inventory_map (item_id);

alter table public.inventory_items enable row level security;
alter table public.inventory_item_moves enable row level security;
alter table public.product_inventory_map enable row level security;

drop policy if exists inventory_items_admin_all on public.inventory_items;
create policy inventory_items_admin_all on public.inventory_items
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists inventory_item_moves_admin_all on public.inventory_item_moves;
create policy inventory_item_moves_admin_all on public.inventory_item_moves
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists product_inventory_map_admin_all on public.product_inventory_map;
create policy product_inventory_map_admin_all on public.product_inventory_map
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.inventory_items to service_role;
grant all on public.inventory_item_moves to service_role;
grant all on public.product_inventory_map to service_role;
