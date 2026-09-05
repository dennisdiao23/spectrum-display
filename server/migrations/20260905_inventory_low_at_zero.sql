-- Default Low-at to 0. Qty 0 with Low-at 0 is special order, not out of stock.
update public.inventory_items
set low_at = 0;

alter table public.inventory_items
  alter column low_at set default 0;

alter table public.inventory_stock
  alter column low_at set default 0;
