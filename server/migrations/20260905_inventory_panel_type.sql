-- Panel type on inventory SKUs: indoor/outdoor × fixed/rental.
alter table public.inventory_items
  add column if not exists panel_type text not null default '';
