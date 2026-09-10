create table if not exists public.company_emails (
  id bigint generated always as identity primary key,
  party_kind text not null,
  party_id bigint not null,
  doc_kind text not null default '',
  doc_id bigint,
  doc_number text not null default '',
  to_emails text not null default '',
  cc_emails text not null default '',
  bcc_emails text not null default '',
  subject text not null default '',
  body_text text not null default '',
  filename text not null default '',
  pdf_base64 text not null default '',
  sent_by_email text not null default '',
  sent_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists company_emails_party_idx
  on public.company_emails (party_kind, party_id, created_at);
alter table public.company_emails enable row level security;
drop policy if exists company_emails_admin_all on public.company_emails;
create policy company_emails_admin_all on public.company_emails
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.company_emails to service_role;
