alter table public.inventory_items
  add column if not exists cost_per_m2 double precision not null default 0;
