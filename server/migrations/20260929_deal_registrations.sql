create table if not exists public.deal_registrations (
  id bigint generated always as identity primary key,
  number text not null unique,
  customer_id bigint not null,
  dealer_user_id bigint,
  end_customer text not null default '',
  job_name text not null default '',
  site_street text not null default '',
  site_city text not null default '',
  site_state text not null default '',
  selling text not null default '',
  expected_date text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  notes text not null default '',
  status text not null default 'submitted',
  protect_until text not null default '',
  decline_reason text not null default '',
  reviewed_at text not null default '',
  reviewed_by text not null default '',
  quote_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_registrations_customer_idx on public.deal_registrations (customer_id, status);
create index if not exists deal_registrations_status_idx on public.deal_registrations (status, protect_until);

alter table public.deal_registrations enable row level security;
