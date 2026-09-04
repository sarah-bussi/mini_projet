-- Private workspace tables and row-level security.
-- Run this file in Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.workspace_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('note','cv','copilot','setting','application')),
  title text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_profiles enable row level security;
alter table public.workspace_data enable row level security;

-- This workspace is intentionally restricted to one Supabase account.
drop policy if exists workspace_profile_owner_select on public.workspace_profiles;
create policy workspace_profile_owner_select
  on public.workspace_profiles for select
  to authenticated
  using (
    auth.uid() = 'c5a95986-040d-4a09-be72-3ef497c65fc9'::uuid
    and user_id = auth.uid()
  );

drop policy if exists workspace_profile_owner_update on public.workspace_profiles;
create policy workspace_profile_owner_update
  on public.workspace_profiles for update
  to authenticated
  using (
    auth.uid() = 'c5a95986-040d-4a09-be72-3ef497c65fc9'::uuid
    and user_id = auth.uid()
  )
  with check (
    auth.uid() = 'c5a95986-040d-4a09-be72-3ef497c65fc9'::uuid
    and user_id = auth.uid()
  );

drop policy if exists workspace_data_owner_all on public.workspace_data;
create policy workspace_data_owner_all
  on public.workspace_data for all
  to authenticated
  using (
    auth.uid() = 'c5a95986-040d-4a09-be72-3ef497c65fc9'::uuid
    and user_id = auth.uid()
  )
  with check (
    auth.uid() = 'c5a95986-040d-4a09-be72-3ef497c65fc9'::uuid
    and user_id = auth.uid()
  );

grant select, update on public.workspace_profiles to authenticated;
grant select, insert, update, delete on public.workspace_data to authenticated;

insert into public.workspace_profiles (user_id, display_name)
values ('c5a95986-040d-4a09-be72-3ef497c65fc9'::uuid, 'Sarah')
on conflict (user_id) do nothing;
