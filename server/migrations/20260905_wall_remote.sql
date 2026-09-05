-- Wall Remote: customer wall settings + command queue for the rack bridge.
create table if not exists public.walls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  processor text not null default 'MX20',
  model text not null default '',
  pitch double precision not null default 1.2,
  cols integer not null default 10,
  rows integer not null default 6,
  cabinet_w_mm double precision not null default 500,
  cabinet_h_mm double precision not null default 500,
  pixel_w integer not null default 0,
  pixel_h integer not null default 0,
  brightness integer not null default 80,
  display_mode text not null default 'on',
  active_preset_id uuid,
  last_seen_at timestamptz,
  bridge_token_hash text not null default '',
  test_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists walls_user_idx on public.walls (user_id, name);
create index if not exists walls_bridge_idx on public.walls (bridge_token_hash);

create table if not exists public.wall_inputs (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references public.walls(id) on delete cascade,
  name text not null,
  connector text not null default '',
  sort_order integer not null default 0
);
create index if not exists wall_inputs_wall_idx on public.wall_inputs (wall_id, sort_order);

create table if not exists public.wall_presets (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references public.walls(id) on delete cascade,
  name text not null,
  layout text not null default 'full',
  novastar_index integer not null default 0,
  sort_order integer not null default 0
);
create index if not exists wall_presets_wall_idx on public.wall_presets (wall_id, sort_order);

create table if not exists public.wall_preset_panes (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.wall_presets(id) on delete cascade,
  pane text not null,
  input_id uuid
);
create index if not exists wall_preset_panes_preset_idx on public.wall_preset_panes (preset_id);

create table if not exists public.wall_commands (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references public.walls(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  acked_at timestamptz
);
create index if not exists wall_commands_wall_idx on public.wall_commands (wall_id, status, created_at);

alter table public.walls enable row level security;
alter table public.wall_inputs enable row level security;
alter table public.wall_presets enable row level security;
alter table public.wall_preset_panes enable row level security;
alter table public.wall_commands enable row level security;

drop policy if exists walls_admin_all on public.walls;
create policy walls_admin_all on public.walls
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists walls_owner_all on public.walls;
create policy walls_owner_all on public.walls
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists wall_inputs_admin_all on public.wall_inputs;
create policy wall_inputs_admin_all on public.wall_inputs
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists wall_inputs_owner_all on public.wall_inputs;
create policy wall_inputs_owner_all on public.wall_inputs
for all using (exists (select 1 from public.walls w where w.id = wall_id and w.user_id = auth.uid()))
with check (exists (select 1 from public.walls w where w.id = wall_id and w.user_id = auth.uid()));

drop policy if exists wall_presets_admin_all on public.wall_presets;
create policy wall_presets_admin_all on public.wall_presets
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists wall_presets_owner_all on public.wall_presets;
create policy wall_presets_owner_all on public.wall_presets
for all using (exists (select 1 from public.walls w where w.id = wall_id and w.user_id = auth.uid()))
with check (exists (select 1 from public.walls w where w.id = wall_id and w.user_id = auth.uid()));

drop policy if exists wall_preset_panes_admin_all on public.wall_preset_panes;
create policy wall_preset_panes_admin_all on public.wall_preset_panes
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists wall_preset_panes_owner_all on public.wall_preset_panes;
create policy wall_preset_panes_owner_all on public.wall_preset_panes
for all using (exists (
  select 1 from public.wall_presets p
  join public.walls w on w.id = p.wall_id
  where p.id = preset_id and w.user_id = auth.uid()
))
with check (exists (
  select 1 from public.wall_presets p
  join public.walls w on w.id = p.wall_id
  where p.id = preset_id and w.user_id = auth.uid()
));

drop policy if exists wall_commands_admin_all on public.wall_commands;
create policy wall_commands_admin_all on public.wall_commands
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists wall_commands_owner_all on public.wall_commands;
create policy wall_commands_owner_all on public.wall_commands
for all using (exists (select 1 from public.walls w where w.id = wall_id and w.user_id = auth.uid()))
with check (exists (select 1 from public.walls w where w.id = wall_id and w.user_id = auth.uid()));

grant all on public.walls to service_role;
grant all on public.wall_inputs to service_role;
grant all on public.wall_presets to service_role;
grant all on public.wall_preset_panes to service_role;
grant all on public.wall_commands to service_role;
grant select, insert, update, delete on public.walls to authenticated;
grant select, insert, update, delete on public.wall_inputs to authenticated;
grant select, insert, update, delete on public.wall_presets to authenticated;
grant select, insert, update, delete on public.wall_preset_panes to authenticated;
grant select, insert, update, delete on public.wall_commands to authenticated;

notify pgrst, 'reload schema';
