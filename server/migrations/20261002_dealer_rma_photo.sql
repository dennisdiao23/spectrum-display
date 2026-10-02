alter table public.dealer_rmas
  add column if not exists photo_name text not null default '',
  add column if not exists photo_url text not null default '';
