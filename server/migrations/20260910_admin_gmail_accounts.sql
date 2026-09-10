alter table public.company_emails add column if not exists from_email text not null default '';

create table if not exists public.admin_gmail_accounts (
  admin_id bigint primary key references public.admins(id) on delete cascade,
  gmail_email text not null,
  refresh_token text not null,
  access_token text not null default '',
  access_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.admin_gmail_accounts enable row level security;
drop policy if exists admin_gmail_accounts_admin_all on public.admin_gmail_accounts;
create policy admin_gmail_accounts_admin_all on public.admin_gmail_accounts
  for all using (public.is_spectrum_admin()) with check (public.is_spectrum_admin());
grant all on public.admin_gmail_accounts to service_role;
