create table if not exists public.dealer_column_prefs (
  dealer_user_id bigint primary key references public.dealer_users(id) on delete cascade,
  prefs text not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.dealer_column_prefs enable row level security;

grant all on public.dealer_column_prefs to service_role;
