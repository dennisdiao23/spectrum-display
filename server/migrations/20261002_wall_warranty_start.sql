alter table public.installed_walls
  add column if not exists warranty_start text not null default '';
