-- Lobby presence: user-set status plus last activity for idle/away
alter table public.chat_presence
  add column if not exists last_active_at timestamptz;
alter table public.chat_presence
  add column if not exists status text not null default 'online';

notify pgrst, 'reload schema';
