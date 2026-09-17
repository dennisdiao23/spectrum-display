alter table public.inventory_items
  add column if not exists mpn text not null default '';

alter table public.purchase_order_lines
  add column if not exists mpn text not null default '';
