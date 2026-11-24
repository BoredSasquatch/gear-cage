-- Gear Cage update 2: prices in LKR or USD, shown in one currency using an exchange rate.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

alter table public.items add column if not exists cost_currency text not null default 'LKR';
alter table public.maintenance add column if not exists cost_currency text not null default 'LKR';

alter table public.settings add column if not exists usd_rate numeric;       -- rupees per 1 US dollar
alter table public.settings add column if not exists rate_date date;
alter table public.settings add column if not exists rate_source text default '';

-- Show totals in rupees by default
update public.settings set currency = coalesce(nullif(currency,''),'LKR') where id = 1;
