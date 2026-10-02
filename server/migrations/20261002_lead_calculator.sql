alter table public.company_crm_leads add column if not exists calculator_query text not null default '';
alter table public.company_crm_leads add column if not exists calculator_summary text not null default '';
alter table public.dealer_leads add column if not exists calculator_query text not null default '';
alter table public.dealer_leads add column if not exists calculator_summary text not null default '';
