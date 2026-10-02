alter table public.dealer_leads add column if not exists crm_lead_id bigint;
alter table public.dealer_leads add column if not exists crm_deal_id bigint;
alter table public.dealer_leads add column if not exists stage text not null default '';
alter table public.dealer_leads add column if not exists stage_updated_at text not null default '';

create index if not exists dealer_leads_crm_lead_idx on public.dealer_leads (crm_lead_id);
