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
