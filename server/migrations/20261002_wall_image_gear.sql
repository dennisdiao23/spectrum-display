alter table public.installed_walls
  add column if not exists panel text not null default '';

alter table public.installed_walls
  add column if not exists controller text not null default '';

alter table public.installed_walls
  add column if not exists image_url text not null default '';
