-- Remember deleted website / store series so seed backfill does not recreate them.

create table if not exists public.catalog_tombstones (
  brand_id text not null,
  series_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (brand_id, series_id)
);
alter table public.catalog_tombstones enable row level security;
drop policy if exists catalog_tombstones_admin_all on public.catalog_tombstones;
create policy catalog_tombstones_admin_all on public.catalog_tombstones
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.catalog_tombstones to service_role;
