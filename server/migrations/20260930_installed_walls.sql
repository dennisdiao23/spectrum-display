create table if not exists public.installed_walls (
  id bigint generated always as identity primary key,
  number text not null unique,
  sales_doc_id bigint unique,
  order_number text not null default '',
  customer_id bigint,
  wall_name text not null default '',
  end_customer text not null default '',
  installer text not null default '',
  pitch text not null default '',
  selected_cob boolean not null default false,
  ship_date text not null default '',
  warranty_end text not null default '',
  support_end text not null default '',
  site_street text not null default '',
  site_city text not null default '',
  site_state text not null default '',
  site_zip text not null default '',
  site_country text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.installed_wall_serials (
  id bigint generated always as identity primary key,
  wall_id bigint not null,
  kind text not null default 'cabinet',
  serial text not null default ''
);

create table if not exists public.installed_wall_spares (
  id bigint generated always as identity primary key,
  wall_id bigint not null,
  sku text not null default '',
  qty integer not null default 0
);

create index if not exists installed_wall_serials_wall_idx on public.installed_wall_serials (wall_id);
create index if not exists installed_wall_spares_wall_idx on public.installed_wall_spares (wall_id);

alter table public.installed_walls enable row level security;
alter table public.installed_wall_serials enable row level security;
alter table public.installed_wall_spares enable row level security;
