alter table public.inventory_items
  add column if not exists item_kind text not null default 'item';

create table if not exists public.inventory_kit_lines (
  id bigint generated always as identity primary key,
  kit_item_id bigint not null references public.inventory_items(id) on delete cascade,
  component_item_id bigint not null references public.inventory_items(id) on delete restrict,
  qty integer not null default 1,
  unique (kit_item_id, component_item_id)
);

create index if not exists inventory_kit_lines_kit_idx
  on public.inventory_kit_lines (kit_item_id);
create index if not exists inventory_kit_lines_component_idx
  on public.inventory_kit_lines (component_item_id);

alter table public.inventory_kit_lines enable row level security;

drop policy if exists inventory_kit_lines_admin_all on public.inventory_kit_lines;
create policy inventory_kit_lines_admin_all on public.inventory_kit_lines
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.inventory_kit_lines to service_role;
