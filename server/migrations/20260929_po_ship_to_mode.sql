alter table public.purchase_orders
  add column if not exists ship_to_mode text not null default 'warehouse';

update public.purchase_orders
set ship_to_mode = 'dropship'
where ship_to_customer_id is not null
  and coalesce(ship_to_mode, '') <> 'dropship';
