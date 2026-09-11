alter table public.inventory_warehouses
  add column if not exists parent_id bigint references public.inventory_warehouses(id) on delete restrict;

create index if not exists inventory_warehouses_parent_idx
  on public.inventory_warehouses (parent_id, type, name);

alter table public.receipt_shipments
  add column if not exists warehouse_id bigint references public.inventory_warehouses(id) on delete set null;

alter table public.receipt_shipment_lines
  add column if not exists warehouse_id bigint references public.inventory_warehouses(id) on delete set null;

create index if not exists receipt_shipments_warehouse_idx
  on public.receipt_shipments (warehouse_id);

create index if not exists receipt_shipment_lines_warehouse_idx
  on public.receipt_shipment_lines (warehouse_id);
