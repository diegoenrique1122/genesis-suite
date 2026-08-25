-- Genesis OS 002B4.B.2A
-- Server-authoritative badges.
-- Goals:
--   1) Remove anonymous/browser write authority from badge tables.
--   2) Restrict catalog visibility to relevant authenticated Genesis users.
--   3) Restrict earned-badge visibility to authorized athlete relationships.
--   4) Move FENIX_12W evaluation to PostgreSQL.
--
-- IMPORTANT:
-- The browser may request evaluation, but it cannot choose or insert awards.

-- ============================================================================
-- RLS ON
-- ============================================================================

alter table public.badges_dictionary enable row level security;
alter table public.athlete_earned_badges enable row level security;

-- ============================================================================
-- CATALOG VISIBILITY HELPER
-- ============================================================================

create or replace function private.can_read_badge_catalog(
  p_coach_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  select um.role::text
    into v_role
  from public.users_master um
  where um.id = v_uid
    and um.account_status::text = 'ACTIVE'
  limit 1;

  if v_role is null then
    return false;
  end if;

  if v_role = 'SUPER_ADMIN' then
    return true;
  end if;

  -- Global/system badges are visible to every ACTIVE authenticated Genesis user.
  if p_coach_id is null then
    return true;
  end if;

  if v_role = 'COACH' then
    return exists (
      select 1
      from public.coaches_profile cp
      where cp.id = p_coach_id
        and cp.user_id = v_uid
    );
  end if;

  if v_role = 'ATHLETE' then
    return exists (
      select 1
      from public.athletes_profile ap
      where ap.user_id = v_uid
        and ap.coach_id = p_coach_id
    );
  end if;

  return false;
end;
$$;

revoke all on function private.can_read_badge_catalog(uuid)
from public, anon;

grant execute on function private.can_read_badge_catalog(uuid)
to authenticated;

-- ============================================================================
-- REMOVE ALL LEGACY / PERMISSIVE POLICIES
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('badges_dictionary', 'athlete_earned_badges')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      r.policyname,
      r.tablename
    );
  end loop;
end;
$$;

-- ============================================================================
-- BADGES DICTIONARY
-- Browser: READ ONLY.
-- ============================================================================

create policy badges_dictionary_select_authorized
on public.badges_dictionary
for select
to authenticated
using (
  private.can_read_badge_catalog(coach_id)
);

-- ============================================================================
-- ATHLETE EARNED BADGES
-- Browser: READ ONLY.
-- Uses the already validated Genesis athlete-access helper.
-- ============================================================================

create policy athlete_earned_badges_select_authorized
on public.athlete_earned_badges
for select
to authenticated
using (
  private.can_read_athlete_profile(athlete_id)
);

-- ============================================================================
-- TABLE GRANTS
-- Revoke inherited PUBLIC access as well as anon/authenticated writes.
-- ============================================================================

revoke all on table public.badges_dictionary
from public, anon, authenticated;

revoke all on table public.athlete_earned_badges
from public, anon, authenticated;

grant select on table public.badges_dictionary
to authenticated;

grant select on table public.athlete_earned_badges
to authenticated;

-- ============================================================================
-- SERVER-AUTHORITATIVE EVALUATION
--
-- Current canonical catalog contains FENIX_12W.
-- This preserves the existing Genesis dashboard behavior:
-- after 84 elapsed program days, the FENIX_12W badge becomes earned.
--
-- The caller can request evaluation but cannot choose the badge or outcome.
-- ============================================================================

create or replace function public.evaluate_athlete_badges(
  p_athlete_id uuid
)
returns table (
  new_badges integer,
  total_badges bigint,
  fenix_12w boolean
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_program_start date;
  v_fenix_badge_id uuid;
  v_inserted integer := 0;
  v_total bigint := 0;
  v_has_fenix boolean := false;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'GENESIS_BADGES: authentication required';
  end if;

  if not exists (
    select 1
    from public.users_master um
    where um.id = v_uid
      and um.account_status::text = 'ACTIVE'
  ) then
    raise exception 'GENESIS_BADGES: active Genesis identity required';
  end if;

  if p_athlete_id is null then
    raise exception 'GENESIS_BADGES: athlete id required';
  end if;

  if not private.can_read_athlete_profile(p_athlete_id) then
    raise exception 'GENESIS_BADGES: athlete access denied';
  end if;

  select ap.program_start_date::date
    into v_program_start
  from public.athletes_profile ap
  where ap.id = p_athlete_id
  limit 1;

  if not found then
    raise exception 'GENESIS_BADGES: athlete profile not found';
  end if;

  select bd.id
    into v_fenix_badge_id
  from public.badges_dictionary bd
  where bd.badge_code = 'FENIX_12W'
    and bd.coach_id is null
  limit 1;

  if v_fenix_badge_id is not null
     and v_program_start is not null
     and current_date >= (v_program_start + 84)
  then
    insert into public.athlete_earned_badges (
      athlete_id,
      badge_id,
      awarded_by
    )
    values (
      p_athlete_id,
      v_fenix_badge_id,
      'SYSTEM'
    )
    on conflict on constraint athlete_earned_badges_athlete_id_badge_id_key
    do nothing;

    get diagnostics v_inserted = row_count;
  end if;

  select
    count(*),
    coalesce(bool_or(bd.badge_code = 'FENIX_12W'), false)
  into
    v_total,
    v_has_fenix
  from public.athlete_earned_badges aeb
  join public.badges_dictionary bd
    on bd.id = aeb.badge_id
  where aeb.athlete_id = p_athlete_id;

  return query
  select
    v_inserted,
    v_total,
    v_has_fenix;
end;
$$;

revoke all on function public.evaluate_athlete_badges(uuid)
from public, anon;

grant execute on function public.evaluate_athlete_badges(uuid)
to authenticated;

comment on function public.evaluate_athlete_badges(uuid) is
'Genesis 002B4.B.2A: server-authoritative badge evaluator. Caller may request evaluation for an authorized athlete but cannot select or insert awards.';
