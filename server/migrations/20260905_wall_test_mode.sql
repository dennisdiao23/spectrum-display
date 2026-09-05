-- Wall Remote: optional testing mode (preview as if the rack bridge is online).
alter table public.walls
  add column if not exists test_mode boolean not null default false;
