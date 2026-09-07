-- Shared display name for Lobby AI and Chat AI (default Claude)
alter table public.chat_ai_settings
  add column if not exists ai_name text not null default 'Claude';

update public.chat_ai_settings
set ai_name = 'Claude'
where ai_name is null or btrim(ai_name) = '';

notify pgrst, 'reload schema';
