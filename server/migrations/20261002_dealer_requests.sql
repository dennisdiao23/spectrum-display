create table if not exists public.dealer_requests (
  id bigint generated always as identity primary key,
  customer_id bigint not null,
  dealer_user_id bigint,
  kind text not null,
  status text not null default 'waiting',
  payload text not null default '{}',
  created_at timestamptz not null default now(),
  reviewed_at text not null default '',
  reviewed_by text not null default ''
);

create index if not exists dealer_requests_customer_idx
  on public.dealer_requests (customer_id, kind, status);

alter table public.dealer_requests enable row level security;
