alter table public.inventory_items
  add column if not exists local_warehouse_cost double precision not null default 0;

alter table public.purchase_orders
  add column if not exists ship_from text not null default '';
