-- Replace legacy inventory_vendors / purchase_orders tables (empty on production)
-- with the schema expected by company.html and store-supabase.js.

drop table if exists public.receipt_shipment_lines cascade;
drop table if exists public.receipt_shipments cascade;
drop table if exists public.purchase_order_lines cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.inventory_vendors cascade;

create table public.inventory_vendors (
  id bigint generated always as identity primary key,
  title text not null default '',
  company_name text not null default '',
  display_name text not null default '',
  contact_first text not null default '',
  contact_middle text not null default '',
  contact_last text not null default '',
  suffix text not null default '',
  email text not null default '',
  email_cc text not null default '',
  email_bcc text not null default '',
  phone text not null default '',
  mobile text not null default '',
  fax text not null default '',
  other_phone text not null default '',
  website text not null default '',
  check_name text not null default '',
  street text not null default '',
  street2 text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  country text not null default 'United States',
  notes text not null default '',
  bank_account text not null default '',
  routing_number text not null default '',
  tax_id text not null default '',
  track_1099 boolean not null default false,
  payment_terms text not null default 'Net 30',
  account_no text not null default '',
  expense_category text not null default '',
  opening_balance numeric not null default 0,
  opening_as_of text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_vendors_name_idx on public.inventory_vendors (company_name, display_name);
alter table public.inventory_vendors enable row level security;
drop policy if exists inventory_vendors_admin_all on public.inventory_vendors;
create policy inventory_vendors_admin_all on public.inventory_vendors
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.inventory_vendors to service_role;

create table public.purchase_orders (
  id bigint generated always as identity primary key,
  number text not null unique,
  vendor_id bigint references public.inventory_vendors(id) on delete set null,
  vendor_name text not null default '',
  vendor_email text not null default '',
  status text not null default 'open',
  issue_date text not null default '',
  due_date text not null default '',
  ship_via text not null default '',
  permit_no text not null default '',
  mailing_address text not null default '',
  ship_to_customer_id bigint references public.company_customers(id) on delete set null,
  ship_to_name text not null default '',
  shipping_address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_orders_vendor_idx on public.purchase_orders (vendor_id, issue_date);
alter table public.purchase_orders enable row level security;
drop policy if exists purchase_orders_admin_all on public.purchase_orders;
create policy purchase_orders_admin_all on public.purchase_orders
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.purchase_orders to service_role;

create table public.purchase_order_lines (
  id bigint generated always as identity primary key,
  po_id bigint not null references public.purchase_orders(id) on delete cascade,
  item_id bigint,
  product text not null default '',
  sku text not null default '',
  description text not null default '',
  qty numeric not null default 0,
  unit_cost numeric not null default 0,
  sort_order integer not null default 0
);
create index purchase_order_lines_po_idx on public.purchase_order_lines (po_id, sort_order);
alter table public.purchase_order_lines enable row level security;
drop policy if exists purchase_order_lines_admin_all on public.purchase_order_lines;
create policy purchase_order_lines_admin_all on public.purchase_order_lines
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.purchase_order_lines to service_role;

create table public.receipt_shipments (
  id bigint generated always as identity primary key,
  number text not null unique,
  vendor_id bigint,
  vendor_name text not null default '',
  po_id bigint,
  po_number text not null default '',
  receipt_date text not null default '',
  memo text not null default '',
  status text not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index receipt_shipments_vendor_idx on public.receipt_shipments (vendor_id, receipt_date);
alter table public.receipt_shipments enable row level security;
drop policy if exists receipt_shipments_admin_all on public.receipt_shipments;
create policy receipt_shipments_admin_all on public.receipt_shipments
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.receipt_shipments to service_role;

create table public.receipt_shipment_lines (
  id bigint generated always as identity primary key,
  receipt_id bigint not null references public.receipt_shipments(id) on delete cascade,
  po_line_id bigint,
  item_id bigint,
  sku text not null default '',
  product text not null default '',
  po_qty numeric not null default 0,
  qty_received numeric not null default 0,
  sort_order integer not null default 0
);
create index receipt_shipment_lines_receipt_idx on public.receipt_shipment_lines (receipt_id, sort_order);
alter table public.receipt_shipment_lines enable row level security;
drop policy if exists receipt_shipment_lines_admin_all on public.receipt_shipment_lines;
create policy receipt_shipment_lines_admin_all on public.receipt_shipment_lines
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.receipt_shipment_lines to service_role;

notify pgrst, 'reload schema';
