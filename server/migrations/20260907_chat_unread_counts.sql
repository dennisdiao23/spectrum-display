-- One-query unread counts for Chat window badges and the contact list
create or replace function public.chat_unread_counts(viewer bigint)
returns table(room_id bigint, kind text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, count(m.id)::bigint
  from public.chat_rooms r
  left join public.chat_room_reads rd
    on rd.room_id = r.id and rd.user_id = viewer
  left join public.chat_messages m
    on m.room_id = r.id
    and m.deleted_at is null
    and (m.user_id is null or m.user_id <> viewer)
    and m.created_at > coalesce(rd.last_read_at, '1970-01-01'::timestamptz)
  where r.kind = 'lobby'
     or (r.kind = 'dm' and (r.dm_user_low_id = viewer or r.dm_user_high_id = viewer))
     or (r.kind = 'copilot' and r.dm_user_low_id = viewer)
     or r.kind = 'order'
  group by r.id, r.kind
$$;

grant execute on function public.chat_unread_counts(bigint) to service_role;

notify pgrst, 'reload schema';
