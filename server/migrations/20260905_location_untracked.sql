-- Location kinds (bin | warehouse | custom) and untracked vendor warehouses.
alter table public.inventory_warehouses
  add column if not exists untracked boolean not null default false;

alter table public.inventory_warehouses
  alter column type set default 'warehouse';

update public.inventory_warehouses
set untracked = true, type = 'warehouse'
where type = 'partner';

update public.inventory_warehouses
set type = 'warehouse'
where type = 'spectrum';

notify pgrst, 'reload schema';
