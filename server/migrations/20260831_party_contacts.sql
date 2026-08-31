-- Multiple contacts per company customer and inventory vendor

create table if not exists public.company_customer_contacts (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.company_customers(id) on delete cascade,
  title text not null default '',
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  suffix text not null default '',
  job_title text not null default '',
  role text not null default '',
  email text not null default '',
  phone text not null default '',
  mobile text not null default '',
  fax text not null default '',
  is_primary boolean not null default false,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_customer_contacts_customer_idx on public.company_customer_contacts (customer_id, sort_order, id);
alter table public.company_customer_contacts enable row level security;
drop policy if exists company_customer_contacts_admin_all on public.company_customer_contacts;
create policy company_customer_contacts_admin_all on public.company_customer_contacts
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.company_customer_contacts to service_role;

create table if not exists public.inventory_vendor_contacts (
  id bigint generated always as identity primary key,
  vendor_id bigint not null references public.inventory_vendors(id) on delete cascade,
  title text not null default '',
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  suffix text not null default '',
  job_title text not null default '',
  role text not null default '',
  email text not null default '',
  phone text not null default '',
  mobile text not null default '',
  fax text not null default '',
  is_primary boolean not null default false,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_vendor_contacts_vendor_idx on public.inventory_vendor_contacts (vendor_id, sort_order, id);
alter table public.inventory_vendor_contacts enable row level security;
drop policy if exists inventory_vendor_contacts_admin_all on public.inventory_vendor_contacts;
create policy inventory_vendor_contacts_admin_all on public.inventory_vendor_contacts
for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.inventory_vendor_contacts to service_role;

-- Backfill primary contact from legacy parent fields
insert into public.company_customer_contacts (
  customer_id, title, first_name, middle_name, last_name, suffix,
  job_title, role, email, phone, mobile, fax, is_primary, notes, sort_order, created_at, updated_at
)
select
  c.id, coalesce(c.title, ''), coalesce(c.contact_first, ''), coalesce(c.contact_middle, ''),
  coalesce(c.contact_last, ''), coalesce(c.suffix, ''), coalesce(c.job_title, ''),
  coalesce(nullif(c.contact_role, ''), 'Primary'), coalesce(c.email, ''), coalesce(c.phone, ''),
  coalesce(c.mobile, ''), coalesce(c.fax, ''), true, '', 0, c.created_at, c.updated_at
from public.company_customers c
where not exists (select 1 from public.company_customer_contacts cc where cc.customer_id = c.id)
  and (c.contact_first <> '' or c.contact_last <> '' or c.email <> '' or c.phone <> '' or c.mobile <> '');

insert into public.inventory_vendor_contacts (
  vendor_id, title, first_name, middle_name, last_name, suffix,
  job_title, role, email, phone, mobile, fax, is_primary, notes, sort_order, created_at, updated_at
)
select
  v.id, coalesce(v.title, ''), coalesce(v.contact_first, ''), coalesce(v.contact_middle, ''),
  coalesce(v.contact_last, ''), coalesce(v.suffix, ''), '',
  'Primary', coalesce(v.email, ''), coalesce(v.phone, ''), coalesce(v.mobile, ''),
  coalesce(v.fax, ''), true, '', 0, v.created_at, v.updated_at
from public.inventory_vendors v
where not exists (select 1 from public.inventory_vendor_contacts vc where vc.vendor_id = v.id)
  and (v.contact_first <> '' or v.contact_last <> '' or v.email <> '' or v.phone <> '' or v.mobile <> '');
