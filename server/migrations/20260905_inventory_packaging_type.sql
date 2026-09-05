-- LED packaging type on inventory SKUs: COB, MIP, GOB, or SMD.
alter table public.inventory_items
  add column if not exists packaging_type text not null default '';
