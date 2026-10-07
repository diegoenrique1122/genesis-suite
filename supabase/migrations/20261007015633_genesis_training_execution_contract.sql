-- GENESIS OS â€” TRAINER PRO TRAINING EXECUTION CONTRACT
--
-- Responsibilities:
--   1) Preserve append-only history of completed Trainer Pro sessions during normal account lifecycle; intentional hard-delete may purge that history.
--   2) Bind every completion to its canonical athlete program.
--   3) Snapshot the approved prescribed workout at completion time.
--   4) Derive athlete, coach, active program and workout server-side.
--   5) Prevent duplicate completion of the same routine day/local date.
--
-- The browser is NOT authoritative for:
--   athlete_id
--   coach_id
--   program_id
--   workout_snapshot
--   completed_at
--   local_date
--
-- The browser may provide only:
--   routine_day
--   IANA timezone

create table if not exists public.athlete_training_sessions (
  id uuid primary key default gen_random_uuid(),

  program_id uuid not null
    references public.athlete_programs(id)
    on delete cascade,

  athlete_id uuid not null
    references public.athletes_profile(id)
    on delete cascade,

  coach_id uuid
    references public.coaches_profile(id)
    on delete set null,

  routine_day integer not null,

  local_date date not null,

  time_zone text not null,

  workout_snapshot jsonb not null,

  performance_data jsonb not null
    default '{}'::jsonb,

  completed_at timestamptz not null
    default pg_catalog.now(),

  created_at timestamptz not null
    default pg_catalog.now(),

  constraint athlete_training_sessions_routine_day_chk
    check (routine_day between 1 and 366),

  constraint athlete_training_sessions_time_zone_chk
    check (pg_catalog.btrim(time_zone) <> ''),

  constraint athlete_training_sessions_workout_snapshot_chk
    check (
      jsonb_typeof(workout_snapshot) = 'object'
    ),

  constraint athlete_training_sessions_performance_data_chk
    check (
      jsonb_typeof(performance_data) = 'object'
    )
);

create unique index if not exists
  athlete_training_sessions_completion_uidx
on public.athlete_training_sessions (
  athlete_id,
  program_id,
  local_date,
  routine_day
);

create index if not exists
  athlete_training_sessions_athlete_completed_idx
on public.athlete_training_sessions (
  athlete_id,
  completed_at desc
);

create index if not exists
  athlete_training_sessions_program_completed_idx
on public.athlete_training_sessions (
  program_id,
  completed_at desc
);

create index if not exists
  athlete_training_sessions_coach_completed_idx
on public.athlete_training_sessions (
  coach_id,
  completed_at desc
)
where coach_id is not null;

alter table public.athlete_training_sessions
  enable row level security;

drop policy if exists
  athlete_training_sessions_select_authorized
on public.athlete_training_sessions;

create policy athlete_training_sessions_select_authorized
on public.athlete_training_sessions
for select
to authenticated
using (
  private.is_super_admin()

  or exists (
    select 1
    from public.athletes_profile ap
    where ap.id =
      athlete_training_sessions.athlete_id
      and ap.user_id = (select auth.uid())
  )

  or private.is_assigned_coach(
    athlete_training_sessions.athlete_id
  )
);

revoke all
on table public.athlete_training_sessions
from public, anon, authenticated;

grant select
on table public.athlete_training_sessions
to authenticated;


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
      pg_catalog.coalesce(
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


-- Public Data API surface.
--
-- This wrapper intentionally remains SECURITY INVOKER.
-- The privileged implementation lives in the non-exposed
-- private schema and independently derives the authenticated
-- athlete and all authoritative execution data.

create or replace function
  public.genesis_athlete_complete_training_session(
    p_routine_day integer,
    p_time_zone text
  )
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select
    private.genesis_athlete_complete_training_session_impl(
      p_routine_day,
      p_time_zone
    );
$$;

revoke all
on function public.genesis_athlete_complete_training_session(
  integer,
  text
)
from public, anon, authenticated;

grant execute
on function public.genesis_athlete_complete_training_session(
  integer,
  text
)
to authenticated;


comment on table public.athlete_training_sessions is
  'Genesis Trainer Pro append-only completed-session history linked to the canonical athlete program. Normal application flows cannot mutate completed sessions; lifecycle hard-delete may purge them through foreign-key cascade.';

comment on function
  private.genesis_athlete_complete_training_session_impl(
    integer,
    text
  )
is
  'Genesis Trainer Pro privileged server-authoritative training completion implementation. Athlete identity, active program, coach, approved workout snapshot, local date and completion timestamp are resolved server-side.';

comment on function
  public.genesis_athlete_complete_training_session(
    integer,
    text
  )
is
  'Genesis Trainer Pro authenticated SECURITY INVOKER RPC surface for idempotent workout completion. Privileged execution is delegated to the private implementation.';
