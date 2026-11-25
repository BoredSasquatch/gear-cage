-- Gear Cage update 4: up to 5 reference photos per kit.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
-- Needs update 3 (photo storage) first.
alter table public.kits add column if not exists photos jsonb not null default '[]'::jsonb;
