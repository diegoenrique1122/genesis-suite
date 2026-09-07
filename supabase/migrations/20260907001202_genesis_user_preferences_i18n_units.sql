-- C3B14.1A: personal locale and unit preferences.
-- Physical measurements remain canonical in athletes_profile: kilograms and centimetres.
-- This table stores display/entry preferences only.

create table public.user_preferences (
  user_id uuid primary key
    references public.users_master(id)
    on delete cascade,
  preferred_locale text not null default 'es'
    check (preferred_locale in ('es', 'en')),
  preferred_unit_system text not null default 'METRIC'
    check (preferred_unit_system in ('METRIC', 'IMPERIAL')),
  coach_admin_unit_system text
    check (coach_admin_unit_system in ('METRIC', 'IMPERIAL')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_preferences is
  'Personal presentation preferences. Measurements in athlete domain tables remain kg/cm.';

comment on column public.user_preferences.preferred_locale is
  'User interface locale: es or en.';

comment on column public.user_preferences.preferred_unit_system is
  'Athlete or user display/input unit system. This never changes canonical stored measurements.';

comment on column public.user_preferences.coach_admin_unit_system is
  'Coach-only administrative display unit system. Null for non-coach accounts.';

revoke all on table public.user_preferences from anon;
revoke all on table public.user_preferences from authenticated;
grant select, insert, update on table public.user_preferences to authenticated;
grant all on table public.user_preferences to service_role;

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function private.validate_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_role public.user_role;
begin
  select um.role
    into v_role
  from public.users_master as um
  where um.id = new.user_id;

  if not found then
    raise exception 'GENESIS_USER_PREFERENCES_UNKNOWN_USER';
  end if;

  if new.coach_admin_unit_system is not null
     and v_role not in ('COACH'::public.user_role, 'SUPER_ADMIN'::public.user_role) then
    raise exception 'GENESIS_USER_PREFERENCES_COACH_UNITS_FORBIDDEN';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.validate_user_preferences() from public;

create trigger trg_validate_user_preferences
before insert or update on public.user_preferences
for each row
execute function private.validate_user_preferences();
