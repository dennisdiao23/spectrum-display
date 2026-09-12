-- Website Control: brand logo, cover, description, and hide-from-catalog.
alter table public.brands add column if not exists logo text not null default '';
alter table public.brands add column if not exists description text not null default '';
alter table public.brands add column if not exists image text not null default '';
alter table public.brands add column if not exists hidden boolean not null default false;
