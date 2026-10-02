alter table public.inventory_items
  add column if not exists docs jsonb not null default '[]'::jsonb;
