-- First-party daily traffic for Company Dashboard (www + US Store).
-- Public pages POST /api/analytics/pageview. Staff read via /api/admin/dashboard.

create table if not exists public.site_pageview_daily (
  day date not null,
  channel text not null,
  views integer not null default 0,
  uniques integer not null default 0,
  actions integer not null default 0,
  primary key (day, channel)
);
create index if not exists site_pageview_daily_day_idx
  on public.site_pageview_daily (day);

create table if not exists public.site_pageview_visitors (
  day date not null,
  channel text not null,
  visitor_hash text not null,
  primary key (day, channel, visitor_hash)
);

create table if not exists public.site_pageview_paths (
  day date not null,
  channel text not null,
  path text not null,
  views integer not null default 0,
  primary key (day, channel, path)
);
create index if not exists site_pageview_paths_day_idx
  on public.site_pageview_paths (day, channel, views desc);

alter table public.site_pageview_daily enable row level security;
alter table public.site_pageview_visitors enable row level security;
alter table public.site_pageview_paths enable row level security;

drop policy if exists site_pageview_daily_admin_all on public.site_pageview_daily;
create policy site_pageview_daily_admin_all on public.site_pageview_daily
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists site_pageview_visitors_admin_all on public.site_pageview_visitors;
create policy site_pageview_visitors_admin_all on public.site_pageview_visitors
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

drop policy if exists site_pageview_paths_admin_all on public.site_pageview_paths;
create policy site_pageview_paths_admin_all on public.site_pageview_paths
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());

grant all on table public.site_pageview_daily to service_role;
grant all on table public.site_pageview_visitors to service_role;
grant all on table public.site_pageview_paths to service_role;
grant select on table public.site_pageview_daily to anon, authenticated;
grant select on table public.site_pageview_paths to anon, authenticated;

create or replace function public.record_site_pageview(
  p_day date,
  p_channel text,
  p_path text,
  p_visitor text,
  p_action boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int := 0;
  ch text := lower(coalesce(p_channel, 'website'));
begin
  if ch <> 'website' and ch <> 'store' then
    ch := 'website';
  end if;

  if coalesce(p_action, false) then
    insert into public.site_pageview_daily (day, channel, views, uniques, actions)
    values (p_day, ch, 0, 0, 1)
    on conflict (day, channel) do update
      set actions = public.site_pageview_daily.actions + 1;
    return;
  end if;

  insert into public.site_pageview_daily (day, channel, views, uniques, actions)
  values (p_day, ch, 1, 0, 0)
  on conflict (day, channel) do update
    set views = public.site_pageview_daily.views + 1;

  if coalesce(p_visitor, '') <> '' then
    insert into public.site_pageview_visitors (day, channel, visitor_hash)
    values (p_day, ch, p_visitor)
    on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted > 0 then
      update public.site_pageview_daily
        set uniques = uniques + 1
        where day = p_day and channel = ch;
    end if;
  end if;

  if coalesce(p_path, '') <> '' then
    insert into public.site_pageview_paths (day, channel, path, views)
    values (p_day, ch, left(p_path, 180), 1)
    on conflict (day, channel, path) do update
      set views = public.site_pageview_paths.views + 1;
  end if;
end;
$$;

revoke all on function public.record_site_pageview(date, text, text, text, boolean) from public;
grant execute on function public.record_site_pageview(date, text, text, text, boolean) to service_role;
