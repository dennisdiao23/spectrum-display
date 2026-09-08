alter table public.inventory_warehouses
  add column if not exists street text not null default '',
  add column if not exists street2 text not null default '',
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists zip text not null default '',
  add column if not exists country text not null default '';

notify pgrst, 'reload schema';
