-- Warehouses and per-SKU locations. Spectrum qty stays on inventory_items.qty
-- as the sum of Spectrum warehouse locations only.

create table if not exists public.inventory_warehouses (
  id bigint generated always as identity primary key,
  name text not null,
  type text not null default 'spectrum',
  vendor_id bigint references public.inventory_vendors(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_warehouses_type_idx on public.inventory_warehouses (type, name);
alter table public.inventory_warehouses enable row level security;
drop policy if exists inventory_warehouses_admin_all on public.inventory_warehouses;
create policy inventory_warehouses_admin_all on public.inventory_warehouses
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.inventory_warehouses to service_role;

create table if not exists public.inventory_item_locations (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  warehouse_id bigint not null references public.inventory_warehouses(id) on delete restrict,
  bin text not null default '',
  qty integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, warehouse_id)
);
create index if not exists inventory_item_locations_wh_idx on public.inventory_item_locations (warehouse_id);
alter table public.inventory_item_locations enable row level security;
drop policy if exists inventory_item_locations_admin_all on public.inventory_item_locations;
create policy inventory_item_locations_admin_all on public.inventory_item_locations
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.inventory_item_locations to service_role;

insert into public.inventory_warehouses (name, type, notes)
select 'Spectrum Warehouse', 'spectrum', ''
where not exists (select 1 from public.inventory_warehouses);

insert into public.inventory_item_locations (item_id, warehouse_id, bin, qty, created_at, updated_at)
select
  i.id,
  (select w.id from public.inventory_warehouses w where w.type = 'spectrum' order by w.id limit 1),
  '',
  coalesce(i.qty, 0),
  coalesce(i.created_at, now()),
  now()
from public.inventory_items i
where not exists (
  select 1 from public.inventory_item_locations l where l.item_id = i.id
)
and exists (select 1 from public.inventory_warehouses w where w.type = 'spectrum');

notify pgrst, 'reload schema';
