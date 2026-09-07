-- Spectrum AI settings (singleton). Ciphertext never leaves the server.
create table if not exists public.chat_ai_settings (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  allow_in_dms boolean not null default false,
  provider text not null default 'anthropic',
  model text not null default 'claude-sonnet-4-6',
  api_key_ciphertext text,
  api_key_last4 text,
  ai_name text not null default 'Claude',
  updated_by_user_id bigint references public.admins(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.chat_ai_settings enable row level security;

drop policy if exists chat_ai_settings_admin_all on public.chat_ai_settings;
create policy chat_ai_settings_admin_all on public.chat_ai_settings
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.chat_ai_settings to service_role;

insert into public.chat_ai_settings (id, enabled, allow_in_dms, provider, model)
values (1, false, false, 'anthropic', 'claude-sonnet-4-6')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
