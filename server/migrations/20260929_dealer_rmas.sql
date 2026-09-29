create table if not exists public.dealer_rmas (
  id bigint generated always as identity primary key,
  number text not null unique,
  customer_id bigint not null,
  dealer_user_id bigint,
  order_ref text not null default '',
  reason text not null default 'other',
  lines_json text not null default '[]',
  notes text not null default '',
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dealer_rmas_customer_idx on public.dealer_rmas (customer_id, created_at);

alter table public.dealer_rmas enable row level security;
