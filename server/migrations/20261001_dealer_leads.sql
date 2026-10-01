create table if not exists public.dealer_leads (
  id bigint generated always as identity primary key,
  number text not null unique,
  customer_id bigint not null,
  project text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  city text not null default '',
  state text not null default '',
  interest text not null default '',
  notes text not null default '',
  status text not null default 'sent',
  reply_note text not null default '',
  replied_at text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dealer_leads_customer_idx on public.dealer_leads (customer_id, created_at);

alter table public.dealer_leads enable row level security;
