create table if not exists public.dealer_applications (
  id bigint generated always as identity primary key,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  company_name text not null default '',
  website text not null default '',
  tax_id text not null default '',
  years_in_business text not null default '',
  company_size text not null default '',
  business_type jsonb not null default '[]'::jsonb,
  primary_verticals jsonb not null default '[]'::jsonb,
  typical_job_size_m2 text not null default '',
  company_address jsonb not null default '{}'::jsonb,
  references_text text not null default '',
  certify_authorized boolean not null default false,
  agree_terms_privacy boolean not null default false,
  marketing_opt_in boolean not null default false,
  resale_certificate_name text not null default '',
  resale_certificate_url text not null default '',
  user_id text not null default '',
  crm_lead_id bigint,
  status text not null default 'pending',
  dealer_tier text not null default 'authorized',
  payment_terms text not null default 'prepaid_30_70',
  hold_hours integer not null default 48,
  customer_id bigint,
  notes_internal text not null default '',
  reviewed_at timestamptz,
  reviewed_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dealer_applications_email_idx
  on public.dealer_applications (email, status);
create index if not exists dealer_applications_status_idx
  on public.dealer_applications (status, created_at desc);
alter table public.dealer_applications enable row level security;
drop policy if exists dealer_applications_admin_all on public.dealer_applications;
create policy dealer_applications_admin_all on public.dealer_applications
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.dealer_applications to service_role;
