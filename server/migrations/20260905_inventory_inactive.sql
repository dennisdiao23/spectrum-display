-- Inactive inventory SKUs stay in history but cannot be used while stock is on hand.
alter table public.inventory_items
  add column if not exists inactive boolean not null default false;
