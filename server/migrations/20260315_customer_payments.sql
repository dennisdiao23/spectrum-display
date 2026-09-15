-- Customer payments + card-fee ledger (fees are NOT invoice line items).

alter table company_customers add column if not exists pass_card_fee boolean not null default false;
alter table company_customers add column if not exists invoice_collect_default text not null default 'full';
alter table company_customers add column if not exists invoice_deposit_kind text not null default 'percent';
alter table company_customers add column if not exists invoice_deposit_value double precision not null default 30;
alter table company_customers add column if not exists card_fee_percent double precision;

create table if not exists company_customer_payments (
  id bigserial primary key,
  customer_id bigint not null references company_customers(id) on delete cascade,
  payment_date text not null default '',
  amount double precision not null default 0,
  method text not null default '',
  reference text not null default '',
  memo text not null default '',
  source text not null default 'manual',
  stripe_payment_intent_id text not null default '',
  stripe_checkout_session_id text not null default '',
  status text not null default 'posted',
  card_fee_amount double precision not null default 0,
  card_fee_percent double precision not null default 0,
  pay_link_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_customer_payments_customer_idx on company_customer_payments (customer_id, payment_date);

create table if not exists company_payment_applications (
  id bigserial primary key,
  payment_id bigint not null references company_customer_payments(id) on delete cascade,
  invoice_id bigint not null references company_sales_docs(id) on delete cascade,
  amount double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists company_payment_applications_payment_idx on company_payment_applications (payment_id);
create index if not exists company_payment_applications_invoice_idx on company_payment_applications (invoice_id);

create table if not exists company_card_fee_entries (
  id bigserial primary key,
  payment_id bigint,
  customer_id bigint,
  invoice_id bigint,
  fee_amount double precision not null default 0,
  fee_percent double precision not null default 0,
  stripe_charge_id text not null default '',
  status text not null default 'charged',
  created_at timestamptz not null default now()
);
create index if not exists company_card_fee_entries_customer_idx on company_card_fee_entries (customer_id, created_at);

create table if not exists company_invoice_pay_links (
  id bigserial primary key,
  token text not null unique,
  invoice_id bigint not null references company_sales_docs(id) on delete cascade,
  customer_id bigint not null references company_customers(id) on delete cascade,
  min_amount double precision not null default 0,
  balance_at_create double precision not null default 0,
  collect_mode text not null default 'full',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_invoice_pay_links_invoice_idx on company_invoice_pay_links (invoice_id, status);
