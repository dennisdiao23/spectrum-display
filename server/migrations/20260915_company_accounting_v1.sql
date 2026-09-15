-- Company Accounting V1: chart of accounts, bills/AP, journals, deposits.

alter table company_customer_payments add column if not exists deposited boolean not null default false;
alter table company_customer_payments add column if not exists journal_id bigint;
alter table company_sales_docs add column if not exists journal_id bigint;
alter table company_card_fee_entries add column if not exists journal_id bigint;

create table if not exists company_gl_accounts (
  id bigserial primary key,
  number text not null unique,
  name text not null default '',
  type text not null default 'expense',
  system_key text not null default '',
  active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_gl_accounts_type_idx on company_gl_accounts (type, number);

create table if not exists company_journal_entries (
  id bigserial primary key,
  number text not null unique,
  entry_date text not null default '',
  memo text not null default '',
  source_type text not null default '',
  source_id bigint,
  status text not null default 'posted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_journal_entries_date_idx on company_journal_entries (entry_date, id);

create table if not exists company_journal_lines (
  id bigserial primary key,
  entry_id bigint not null references company_journal_entries(id) on delete cascade,
  account_id bigint not null references company_gl_accounts(id),
  description text not null default '',
  debit double precision not null default 0,
  credit double precision not null default 0,
  sort_order integer not null default 0
);
create index if not exists company_journal_lines_entry_idx on company_journal_lines (entry_id, sort_order);
create index if not exists company_journal_lines_account_idx on company_journal_lines (account_id);

create table if not exists company_bills (
  id bigserial primary key,
  number text not null unique,
  vendor_id bigint not null references inventory_vendors(id),
  bill_date text not null default '',
  due_date text not null default '',
  status text not null default 'open',
  terms text not null default 'Net 30',
  memo text not null default '',
  po_id bigint,
  subtotal double precision not null default 0,
  tax double precision not null default 0,
  total double precision not null default 0,
  journal_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_bills_vendor_idx on company_bills (vendor_id, bill_date);

create table if not exists company_bill_lines (
  id bigserial primary key,
  bill_id bigint not null references company_bills(id) on delete cascade,
  sku text not null default '',
  item text not null default '',
  description text not null default '',
  qty double precision not null default 0,
  unit_cost double precision not null default 0,
  amount double precision not null default 0,
  account_id bigint,
  sort_order integer not null default 0
);
create index if not exists company_bill_lines_bill_idx on company_bill_lines (bill_id, sort_order);

create table if not exists company_bill_payments (
  id bigserial primary key,
  vendor_id bigint not null references inventory_vendors(id),
  payment_date text not null default '',
  amount double precision not null default 0,
  method text not null default 'ACH',
  reference text not null default '',
  memo text not null default '',
  bank_account_id bigint,
  status text not null default 'posted',
  journal_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_bill_payments_vendor_idx on company_bill_payments (vendor_id, payment_date);

create table if not exists company_bill_payment_apps (
  id bigserial primary key,
  payment_id bigint not null references company_bill_payments(id) on delete cascade,
  bill_id bigint not null references company_bills(id) on delete cascade,
  amount double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists company_bill_payment_apps_payment_idx on company_bill_payment_apps (payment_id);
create index if not exists company_bill_payment_apps_bill_idx on company_bill_payment_apps (bill_id);

create table if not exists company_bank_deposits (
  id bigserial primary key,
  number text not null unique,
  deposit_date text not null default '',
  bank_account_id bigint not null references company_gl_accounts(id),
  memo text not null default '',
  total double precision not null default 0,
  status text not null default 'posted',
  journal_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_bank_deposit_payments (
  id bigserial primary key,
  deposit_id bigint not null references company_bank_deposits(id) on delete cascade,
  payment_id bigint not null unique
);
create index if not exists company_bank_deposit_payments_deposit_idx on company_bank_deposit_payments (deposit_id);

-- Seed default chart of accounts (safe upsert by number)
insert into company_gl_accounts (number, name, type, system_key, active, is_system)
values
  ('1000', 'Checking', 'bank', 'checking', true, true),
  ('1050', 'Undeposited Funds', 'other_current_asset', 'undeposited', true, true),
  ('1100', 'Accounts Receivable', 'accounts_receivable', 'ar', true, true),
  ('1200', 'Inventory Asset', 'inventory', 'inventory', true, true),
  ('2000', 'Accounts Payable', 'accounts_payable', 'ap', true, true),
  ('3000', 'Owner''s Equity', 'equity', 'equity', true, true),
  ('4000', 'Sales Income', 'income', 'sales', true, true),
  ('4100', 'Card Fee Income', 'other_income', 'card_fee_income', true, true),
  ('5000', 'Cost of Goods Sold', 'cogs', 'cogs', true, true),
  ('6000', 'Operating Expense', 'expense', 'expense', true, true),
  ('6100', 'Card Processing Fees', 'expense', 'card_fee_expense', true, true)
on conflict (number) do update set
  system_key = excluded.system_key,
  is_system = true,
  updated_at = now()
where company_gl_accounts.system_key = '' or company_gl_accounts.system_key is null;
