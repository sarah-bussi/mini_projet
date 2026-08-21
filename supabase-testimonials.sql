-- Backend de modération des témoignages du portfolio Sarah Bussi
-- À exécuter dans Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role text not null check (char_length(trim(role)) between 2 and 160),
  organization text check (organization is null or char_length(trim(organization)) <= 160),
  verification_contact text check (verification_contact is null or char_length(trim(verification_contact)) between 5 and 320),
  collaboration_context text not null check (char_length(trim(collaboration_context)) between 10 and 800),
  testimonial text not null check (char_length(trim(testimonial)) between 40 and 1200),
  strengths text[] not null default '{}',
  identity_mode text not null check (identity_mode in ('full', 'first', 'initials', 'role')),
  consent boolean not null check (consent = true),
  submission_language text not null default 'fr' check (submission_language in ('fr', 'en')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  approved_at timestamptz
);

create index if not exists testimonials_status_created_idx
  on public.testimonials (status, created_at desc);

alter table public.testimonials enable row level security;

drop policy if exists testimonials_anon_insert on public.testimonials;
create policy testimonials_anon_insert
  on public.testimonials
  for insert
  to anon
  with check (status = 'pending' and consent = true);

drop policy if exists testimonials_moderator_select on public.testimonials;
create policy testimonials_moderator_select
  on public.testimonials
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator');

drop policy if exists testimonials_moderator_update on public.testimonials;
create policy testimonials_moderator_update
  on public.testimonials
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator');

revoke all on table public.testimonials from anon, authenticated;
grant insert (
  full_name,
  role,
  organization,
  verification_contact,
  collaboration_context,
  testimonial,
  strengths,
  identity_mode,
  consent,
  submission_language
) on public.testimonials to anon;
grant select on public.testimonials to authenticated;
grant update (status, moderated_at, approved_at, verification_contact)
  on public.testimonials to authenticated;

create or replace function public.testimonial_initials(input_name text)
returns text
language sql
immutable
strict
as $$
  select string_agg(upper(left(part, 1)) || '.', '')
  from regexp_split_to_table(trim(input_name), '\s+') as part;
$$;

create or replace function public.get_published_testimonials()
returns table (
  id uuid,
  display_name text,
  public_role text,
  organization text,
  collaboration_context text,
  testimonial text,
  approved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    case t.identity_mode
      when 'full' then t.full_name
      when 'first' then split_part(trim(t.full_name), ' ', 1)
      when 'initials' then public.testimonial_initials(t.full_name)
      when 'role' then t.role
    end as display_name,
    case when t.identity_mode = 'role' then null else t.role end as public_role,
    nullif(trim(t.organization), '') as organization,
    t.collaboration_context,
    t.testimonial,
    t.approved_at
  from public.testimonials as t
  where t.status = 'approved'
  order by t.approved_at desc nulls last
  limit 6;
$$;

revoke all on function public.get_published_testimonials() from public;
grant execute on function public.get_published_testimonials() to anon, authenticated;

-- Après avoir créé Sarah dans Authentication > Users, lui attribuer le rôle :
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--   || '{"role":"moderator"}'::jsonb
-- where email = 'ADRESSE_ADMIN';
