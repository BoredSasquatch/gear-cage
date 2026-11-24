-- Gear Cage (team edition) database schema for Supabase.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to run again: it only creates what is missing.

create extension if not exists pgcrypto;

-- ---------- people ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'pending' check (role in ('admin','crew','pending','disabled')),
  created_at timestamptz not null default now()
);

-- ---------- studio settings (one row) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  studio text default 'Kehelmala Productions',
  currency text default 'LKR',
  -- Anyone signing in with an email at this domain becomes crew automatically. Others wait for an admin.
  allowed_domain text default '',
  -- The first person to sign in with this email becomes an admin.
  owner_email text default '',
  usd_rate numeric,            -- rupees per 1 US dollar, used to show every price in one currency
  rate_date date,
  rate_source text default ''
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- gear ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  name text not null,
  brand text default '',
  model text default '',
  category text default 'Accessory',
  serial text default '',
  room text default '',
  shelf text default '',
  is_case boolean not null default false,       -- a Pelican case, bag or crate that holds other items
  home_case_id uuid references public.items(id) on delete set null,  -- fixed home case, if any
  in_case_id uuid references public.items(id) on delete set null,    -- case it is packed in right now
  critical boolean not null default false,
  status text not null default 'available' check (status in ('available','out','maintenance','lost','retired')),
  purchase_cost numeric,
  purchase_date date,
  replacement_cost numeric,
  cost_currency text not null default 'LKR',   -- currency of purchase and replacement cost: LKR or USD
  supplier text default '',
  service_days int,
  last_serviced date,
  companions uuid[] not null default '{}',
  notes text default '',
  example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text unique,
  description text default '',
  item_ids uuid[] not null default '{}',
  example boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- jobs (shoots) ----------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  due_on date,
  responsible_id uuid references public.profiles(id) on delete set null,
  status text not null default 'booked' check (status in ('booked','out','wrapped','closed','cancelled')),
  notes text default '',
  kit_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  out_at timestamptz,
  wrapped_at timestamptz,
  closed_at timestamptz,
  example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per item on a job. The state moves: planned > pulled > out > packed (at wrap) > returned (at studio).
create table if not exists public.job_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  kit_id uuid references public.kits(id) on delete set null,
  via text default 'added',              -- kit, added, companion, scan, case
  parent_id uuid,                        -- the item or case that brought this line in
  state text not null default 'planned' check (state in ('planned','pulled','left','out','packed','loose','returned','damaged','missing')),
  reason text default '',
  packed_case_id uuid references public.items(id) on delete set null,
  out_by uuid, out_at timestamptz,
  wrap_by uuid, wrap_at timestamptz,
  back_by uuid, back_at timestamptz,
  note text default '',
  maint_id uuid,
  updated_at timestamptz not null default now(),
  unique (job_id, item_id)
);

-- ---------- history: every scan and move, for "where is it" and "who had it" ----------
create table if not exists public.events (
  id uuid primary key,                   -- made on the phone so offline scans sync once
  at timestamptz not null default now(),
  by uuid,
  item_id uuid references public.items(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  case_id uuid references public.items(id) on delete set null,
  action text not null,                  -- pulled, out, packed, loose, returned, damaged, missing, moved, created, edited
  note text default ''
);
create index if not exists events_item_idx on public.events(item_id, at desc);

-- ---------- maintenance ----------
create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade,
  date date default current_date,
  type text default 'Service',
  description text default '',
  cost numeric,
  cost_currency text not null default 'LKR',
  vendor text default '',
  status text not null default 'open' check (status in ('open','done')),
  job_id uuid references public.jobs(id) on delete set null,
  completed_at date,
  example boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- keep updated_at current ----------
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['items','kits','jobs','job_lines','maintenance'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s; create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch();', t);
  end loop;
end $$;

-- ---------- new sign-ins get a profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record; r text := 'pending'; dom text;
begin
  select * into s from public.settings where id = 1;
  dom := lower(split_part(coalesce(new.email,''), '@', 2));
  if s.owner_email <> '' and lower(new.email) = lower(s.owner_email) then r := 'admin';
  elsif s.allowed_domain <> '' and dom = lower(s.allowed_domain) then r := 'crew';
  elsif not exists (select 1 from public.profiles) then r := 'admin';  -- the very first person becomes admin
  end if;
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- access rules ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'none')
$$;
create or replace function public.is_member() returns boolean language sql stable as $$ select public.my_role() in ('admin','crew') $$;
create or replace function public.is_admin() returns boolean language sql stable as $$ select public.my_role() = 'admin' $$;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.items enable row level security;
alter table public.kits enable row level security;
alter table public.jobs enable row level security;
alter table public.job_lines enable row level security;
alter table public.events enable row level security;
alter table public.maintenance enable row level security;

-- people: members see the crew list; everyone sees themselves; you can rename yourself; admins manage roles
drop policy if exists p_read on public.profiles;
create policy p_read on public.profiles for select using (public.is_member() or id = auth.uid());
drop policy if exists p_self on public.profiles;
create policy p_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());
drop policy if exists p_admin on public.profiles;
create policy p_admin on public.profiles for update using (public.is_admin());

drop policy if exists s_read on public.settings;
create policy s_read on public.settings for select using (auth.uid() is not null);
drop policy if exists s_admin on public.settings;
create policy s_admin on public.settings for update using (public.is_admin());

-- gear, kits, jobs, lines, maintenance: members read and write; only admins delete
do $$ declare t text; begin
  foreach t in array array['items','kits','jobs','job_lines','maintenance'] loop
    execute format('drop policy if exists m_read on public.%1$s; create policy m_read on public.%1$s for select using (public.is_member());', t);
    execute format('drop policy if exists m_ins on public.%1$s; create policy m_ins on public.%1$s for insert with check (public.is_member());', t);
    execute format('drop policy if exists m_upd on public.%1$s; create policy m_upd on public.%1$s for update using (public.is_member());', t);
    execute format('drop policy if exists m_del on public.%1$s; create policy m_del on public.%1$s for delete using (public.is_admin());', t);
  end loop;
end $$;
-- job lines can be removed by members while a job is still being planned
drop policy if exists m_del_planned on public.job_lines;
create policy m_del_planned on public.job_lines for delete using (public.is_member() and state in ('planned','pulled','left'));

-- history: members read and add; nobody edits or deletes it
drop policy if exists e_read on public.events;
create policy e_read on public.events for select using (public.is_member());
drop policy if exists e_ins on public.events;
create policy e_ins on public.events for insert with check (public.is_member() and by = auth.uid());
