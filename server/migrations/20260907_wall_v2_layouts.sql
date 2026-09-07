-- Wall Remote v2: audio follow + template layouts (quad / 5-up / cinema / 32:9).
alter table public.walls
  add column if not exists audio_enabled boolean not null default false;
alter table public.walls
  add column if not exists audio_pane text not null default '';
