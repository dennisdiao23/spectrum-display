-- Company staff chat: lobby, order threads, 1:1 DMs
create table if not exists public.chat_rooms (
  id bigint generated always as identity primary key,
  kind text not null,
  sales_order_id bigint references public.company_sales_docs(id) on delete cascade,
  dm_user_low_id bigint references public.admins(id) on delete cascade,
  dm_user_high_id bigint references public.admins(id) on delete cascade,
  title text not null default '',
  customer_name text not null default '',
  order_status text not null default '',
  last_message_at timestamptz,
  last_message_preview text not null default '',
  last_message_user_id bigint references public.admins(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists chat_rooms_lobby_uidx on public.chat_rooms (kind) where kind = 'lobby';
create unique index if not exists chat_rooms_order_uidx on public.chat_rooms (sales_order_id) where kind = 'order';
create unique index if not exists chat_rooms_dm_uidx on public.chat_rooms (dm_user_low_id, dm_user_high_id) where kind = 'dm';
create index if not exists chat_rooms_kind_last_idx on public.chat_rooms (kind, last_message_at desc nulls last);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.chat_rooms(id) on delete cascade,
  user_id bigint references public.admins(id) on delete set null,
  body text not null default '',
  attachment_url text,
  attachment_name text,
  attachment_type text not null default 'none',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by_user_id bigint references public.admins(id) on delete set null
);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, created_at, id);

create table if not exists public.chat_room_reads (
  user_id bigint not null references public.admins(id) on delete cascade,
  room_id bigint not null references public.chat_rooms(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (user_id, room_id)
);

create table if not exists public.chat_presence (
  user_id bigint primary key references public.admins(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  last_active_at timestamptz,
  status text not null default 'online'
);

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_room_reads enable row level security;
alter table public.chat_presence enable row level security;

drop policy if exists chat_rooms_admin_all on public.chat_rooms;
create policy chat_rooms_admin_all on public.chat_rooms
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists chat_messages_admin_all on public.chat_messages;
create policy chat_messages_admin_all on public.chat_messages
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists chat_room_reads_admin_all on public.chat_room_reads;
create policy chat_room_reads_admin_all on public.chat_room_reads
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
drop policy if exists chat_presence_admin_all on public.chat_presence;
create policy chat_presence_admin_all on public.chat_presence
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on public.chat_rooms to service_role;
grant all on public.chat_messages to service_role;
grant all on public.chat_room_reads to service_role;
grant all on public.chat_presence to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.chat_rooms (kind, title)
select 'lobby', 'Lobby'
where not exists (select 1 from public.chat_rooms where kind = 'lobby');

insert into public.chat_rooms (kind, sales_order_id, title, customer_name, order_status)
select 'order', d.id, coalesce(d.number, 'Order #' || d.id), coalesce(d.customer_name, ''), coalesce(d.status, '')
from public.company_sales_docs d
where d.type = 'order'
  and not exists (
    select 1 from public.chat_rooms r where r.kind = 'order' and r.sales_order_id = d.id
  );

notify pgrst, 'reload schema';
