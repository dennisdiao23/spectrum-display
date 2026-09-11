-- Approximate visitor city/region/country on pageview events. IP is never stored.

alter table public.site_pageview_events
  add column if not exists location_country text not null default '',
  add column if not exists location_region text not null default '',
  add column if not exists location_city text not null default '';

create index if not exists site_pageview_events_place_idx
  on public.site_pageview_events (day, location_country);

drop function if exists public.record_site_pageview(date, text, text, text, boolean, text, text);

create or replace function public.record_site_pageview(
  p_day date,
  p_channel text,
  p_path text,
  p_visitor text,
  p_action boolean,
  p_source text default 'Direct',
  p_referrer text default '',
  p_country text default '',
  p_region text default '',
  p_city text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int := 0;
  ch text := lower(coalesce(p_channel, 'website'));
  src text := left(coalesce(nullif(btrim(p_source), ''), 'Direct'), 80);
  ref text := left(coalesce(p_referrer, ''), 120);
  country text := left(upper(coalesce(p_country, '')), 2);
  region text := left(coalesce(p_region, ''), 40);
  city text := left(coalesce(p_city, ''), 80);
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

    insert into public.site_pageview_events
      (day, channel, visitor_hash, path, referrer_host, source,
       location_country, location_region, location_city)
    values (p_day, ch, coalesce(p_visitor, ''), left(p_path, 180), ref, src,
            country, region, city);

    delete from public.site_pageview_events
      where day < (p_day - 90);
  end if;
end;
$$;

revoke all on function public.record_site_pageview(date, text, text, text, boolean, text, text, text, text, text) from public;
grant execute on function public.record_site_pageview(date, text, text, text, boolean, text, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
