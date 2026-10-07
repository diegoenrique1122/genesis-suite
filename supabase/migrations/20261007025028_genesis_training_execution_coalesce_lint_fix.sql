-- ============================================================
-- GENESIS TRAINING EXECUTION — POST-DEPLOY LINT FIX
-- ============================================================
--
-- Source migration:
--   20261007015633_genesis_training_execution_contract.sql
--
-- Purpose:
--   Correct PL/pgSQL resolution of the COALESCE expression.
--
-- The original implementation incorrectly schema-qualified
-- the PostgreSQL COALESCE conditional expression.
--
-- No table, RLS policy, index, public RPC signature or
-- training-session business contract changes here.
-- ============================================================

create or replace function
  private.genesis_athlete_complete_training_session_impl(
    p_routine_day integer,
    p_time_zone text
  )
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid :=
    (select auth.uid());

  v_now timestamptz :=
    pg_catalog.now();

  v_time_zone text :=
    pg_catalog.btrim(
      coalesce(
        p_time_zone,
        ''
      )
    );

  v_local_date date;

  v_athlete_id uuid;
  v_coach_id uuid;

  v_routine_status text;
  v_training_plan jsonb;

  v_program_id uuid;

  v_workout_snapshot jsonb;

  v_session_id uuid;
  v_completed_at timestamptz;

  v_already_completed boolean := false;
begin

  if v_actor_user_id is null then
    raise exception
      'GENESIS_TRAINING_SESSION_AUTH_REQUIRED';
  end if;

  if p_routine_day is null
     or p_routine_day not between 1 and 366 then
    raise exception
      'GENESIS_TRAINING_SESSION_INVALID_ROUTINE_DAY';
  end if;

  if v_time_zone = '' then
    raise exception
      'GENESIS_TRAINING_SESSION_TIME_ZONE_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names tz
    where tz.name = v_time_zone
  ) then
    raise exception
      'GENESIS_TRAINING_SESSION_INVALID_TIME_ZONE';
  end if;

  v_local_date :=
    pg_catalog.timezone(
      v_time_zone,
      v_now
    )::date;

  select
    ap.id,
    ap.coach_id,
    ap.routine_status,
    ap.training_plan
  into
    v_athlete_id,
    v_coach_id,
    v_routine_status,
    v_training_plan
  from public.athletes_profile ap
  join public.users_master um
    on um.id = ap.user_id
  where ap.user_id = v_actor_user_id
    and um.account_status::text = 'ACTIVE'
  limit 1;

  if v_athlete_id is null then
    raise exception
      'GENESIS_TRAINING_SESSION_ATHLETE_NOT_FOUND';
  end if;

  if v_coach_id is null then
    raise exception
      'GENESIS_TRAINING_SESSION_COACH_REQUIRED';
  end if;

  if v_routine_status is distinct from 'APPROVED' then
    raise exception
      'GENESIS_TRAINING_SESSION_ROUTINE_NOT_APPROVED';
  end if;

  if v_training_plan is null
     or jsonb_typeof(v_training_plan) <> 'array' then
    raise exception
      'GENESIS_TRAINING_SESSION_PLAN_INVALID';
  end if;

  select apg.id
  into v_program_id
  from public.athlete_programs apg
  where apg.athlete_id = v_athlete_id
    and apg.coach_id = v_coach_id
    and apg.status in (
      'ACTIVE',
      'SCHEDULED'
    )
    and apg.service_focus in (
      'TRAINING',
      'BOTH'
    )
    and apg.starts_at is not null
    and apg.ends_at is not null
    and apg.starts_at <= v_now
    and apg.ends_at > v_now
  order by apg.starts_at desc
  limit 1;

  if v_program_id is null then
    raise exception
      'GENESIS_TRAINING_SESSION_ACTIVE_PROGRAM_REQUIRED';
  end if;

  select workout.value
  into v_workout_snapshot
  from pg_catalog.jsonb_array_elements(
    v_training_plan
  ) as workout(value)
  where
    workout.value ? 'day'
    and (
      workout.value ->> 'day'
    ) ~ '^[0-9]+$'
    and (
      workout.value ->> 'day'
    )::integer = p_routine_day
  limit 1;

  if v_workout_snapshot is null then
    raise exception
      'GENESIS_TRAINING_SESSION_DAY_NOT_FOUND';
  end if;

  insert into public.athlete_training_sessions (
    program_id,
    athlete_id,
    coach_id,
    routine_day,
    local_date,
    time_zone,
    workout_snapshot,
    performance_data,
    completed_at
  )
  values (
    v_program_id,
    v_athlete_id,
    v_coach_id,
    p_routine_day,
    v_local_date,
    v_time_zone,
    v_workout_snapshot,
    '{}'::jsonb,
    v_now
  )
  on conflict (
    athlete_id,
    program_id,
    local_date,
    routine_day
  )
  do nothing
  returning
    id,
    completed_at
  into
    v_session_id,
    v_completed_at;

  if v_session_id is null then

    v_already_completed := true;

    select
      ats.id,
      ats.completed_at
    into
      v_session_id,
      v_completed_at
    from public.athlete_training_sessions ats
    where ats.athlete_id = v_athlete_id
      and ats.program_id = v_program_id
      and ats.local_date = v_local_date
      and ats.routine_day = p_routine_day
    limit 1;

  end if;

  if v_session_id is null then
    raise exception
      'GENESIS_TRAINING_SESSION_PERSISTENCE_FAILED';
  end if;

  return pg_catalog.jsonb_build_object(
    'ok',
    true,

    'session_id',
    v_session_id,

    'program_id',
    v_program_id,

    'athlete_id',
    v_athlete_id,

    'coach_id',
    v_coach_id,

    'routine_day',
    p_routine_day,

    'local_date',
    v_local_date,

    'time_zone',
    v_time_zone,

    'completed_at',
    v_completed_at,

    'already_completed',
    v_already_completed
  );

end;
$$;


revoke all
on function private.genesis_athlete_complete_training_session_impl(
  integer,
  text
)
from public, anon, authenticated;

grant execute
on function private.genesis_athlete_complete_training_session_impl(
  integer,
  text
)
to authenticated;

comment on function
  private.genesis_athlete_complete_training_session_impl(
    integer,
    text
  )
is
  'Genesis Trainer Pro privileged server-authoritative training completion implementation. Athlete identity, active program, coach, approved workout snapshot, local date and completion timestamp are resolved server-side.';