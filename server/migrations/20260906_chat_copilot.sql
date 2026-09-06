-- Copilot: per-user chat rooms, drafts for review, audit log
create unique index if not exists chat_rooms_copilot_uidx
  on public.chat_rooms (dm_user_low_id) where kind = 'copilot';

create table if not exists public.copilot_drafts (
  token text primary key,
  user_id bigint not null references public.admins(id) on delete cascade,
  room_id bigint references public.chat_rooms(id) on delete set null,
  kind text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  result_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists copilot_drafts_user_idx on public.copilot_drafts (user_id, created_at desc);

create table if not exists public.copilot_audit (
  id bigint generated always as identity primary key,
  user_id bigint references public.admins(id) on delete set null,
  room_id bigint references public.chat_rooms(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists copilot_audit_user_idx on public.copilot_audit (user_id, created_at desc);

alter table public.copilot_drafts enable row level security;
alter table public.copilot_audit enable row level security;

drop policy if exists copilot_drafts_admin_all on public.copilot_drafts;
create policy copilot_drafts_admin_all on public.copilot_drafts
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists copilot_audit_admin_all on public.copilot_audit;
create policy copilot_audit_admin_all on public.copilot_audit
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.copilot_drafts to service_role;
grant all on public.copilot_audit to service_role;
grant usage, select on all sequences in schema public to service_role;

notify pgrst, 'reload schema';
