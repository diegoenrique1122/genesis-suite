-- GENESIS OS — TRAINER PRO PERFORMANCE CONTRACT B.3.2
--
-- Responsibilities:
--   1) Preserve the existing server-authoritative completion model.
--   2) Allow the authenticated athlete to submit actual set performance.
--   3) Never trust browser-provided athlete/program/coach/workout identity.
--   4) Resolve exercise names from the approved workout snapshot.
--   5) Canonicalize and validate performance_data before persistence.
--   6) Preserve idempotent completion semantics.
--   7) Preserve backward compatibility for callers that omit performance_data.
--
-- Canonical athlete-supplied payload:
--
-- {
--   "schema_version": 1,
--   "weight_unit": "KG" | "LB",
--   "exercises": [
--     {
--       "exercise_index": 0,
--       "sets": [
--         {
--           "set_number": 1,
--           "weight": 100,
--           "reps": 10,
--           "rir": 2
--         }
--       ]
--     }
--   ]
-- }
--
-- Server-generated fields inside stored performance_data:
--   exercise_name
--
-- Empty {} remains valid for backward compatibility.


-- ============================================================
-- PRECONDITION
-- Exactly one legacy public wrapper and one private
-- implementation must exist. Refuse migration on drift.
-- ============================================================

do $$
declare
  v_public_count integer;
  v_private_count integer;
begin
  select count(*)
  into v_public_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname =
        'genesis_athlete_complete_training_session';

  select count(*)
  into v_private_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname =
        'genesis_athlete_complete_training_session_impl';

  if v_public_count <> 1 then
    raise exception
      'GENESIS_B32_PUBLIC_COMPLETION_SIGNATURE_DRIFT';
  end if;

  if v_private_count <> 1 then
    raise exception
      'GENESIS_B32_PRIVATE_COMPLETION_SIGNATURE_DRIFT';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname =
          'genesis_athlete_complete_training_session'
      and pg_catalog.pg_get_function_identity_arguments(
            p.oid
          ) =
          'p_routine_day integer, p_time_zone text'
  ) then
    raise exception
      'GENESIS_B32_PUBLIC_LEGACY_SIGNATURE_MISSING';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname =
          'genesis_athlete_complete_training_session_impl'
      and pg_catalog.pg_get_function_identity_arguments(
            p.oid
          ) =
          'p_routine_day integer, p_time_zone text'
  ) then
    raise exception
      'GENESIS_B32_PRIVATE_LEGACY_SIGNATURE_MISSING';
  end if;
end
$$;


-- Public wrapper depends on private implementation.
drop function
  public.genesis_athlete_complete_training_session(
    integer,
    text
  );

drop function
  private.genesis_athlete_complete_training_session_impl(
    integer,
    text
  );


-- ============================================================
-- PRIVATE IMPLEMENTATION
-- ============================================================

create function
  private.genesis_athlete_complete_training_session_impl(
    p_routine_day integer,
    p_time_zone text,
    p_performance_data jsonb default '{}'::jsonb
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

  v_performance_input jsonb :=
    coalesce(
      p_performance_data,
      '{}'::jsonb
    );

  v_performance_normalized jsonb :=
    '{}'::jsonb;

  v_weight_unit text;

  v_exercise jsonb;
  v_exercise_index integer;
  v_snapshot_exercise jsonb;
  v_prescribed_sets integer;

  v_set jsonb;
  v_set_number integer;
  v_weight numeric;
  v_reps integer;
  v_rir numeric;

  v_seen_exercise_indexes integer[] :=
    array[]::integer[];

  v_seen_set_numbers integer[];

  v_normalized_exercises jsonb :=
    '[]'::jsonb;

  v_normalized_sets jsonb;

  v_stored_performance_data jsonb :=
    '{}'::jsonb;
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
     or pg_catalog.jsonb_typeof(
          v_training_plan
        ) <> 'array' then
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


  -- ==========================================================
  -- PERFORMANCE CONTRACT
  -- ==========================================================

  if pg_catalog.jsonb_typeof(
       v_performance_input
     ) <> 'object' then
    raise exception
      'GENESIS_TRAINING_SESSION_PERFORMANCE_INVALID';
  end if;

  -- Empty object is the backward-compatible legacy payload.
  if v_performance_input <> '{}'::jsonb then

    if exists (
      select 1
      from pg_catalog.jsonb_object_keys(
        v_performance_input
      ) as root_key(key_name)
      where root_key.key_name not in (
        'schema_version',
        'weight_unit',
        'exercises'
      )
    ) then
      raise exception
        'GENESIS_TRAINING_SESSION_PERFORMANCE_INVALID';
    end if;

    if pg_catalog.jsonb_typeof(
         v_performance_input -> 'schema_version'
       ) <> 'number'
       or (
         v_performance_input ->> 'schema_version'
       )::numeric <> 1 then
      raise exception
        'GENESIS_TRAINING_SESSION_PERFORMANCE_SCHEMA_UNSUPPORTED';
    end if;

    v_weight_unit :=
      pg_catalog.upper(
        pg_catalog.btrim(
          coalesce(
            v_performance_input ->> 'weight_unit',
            ''
          )
        )
      );

    if v_weight_unit not in (
      'KG',
      'LB'
    ) then
      raise exception
        'GENESIS_TRAINING_SESSION_PERFORMANCE_WEIGHT_UNIT_INVALID';
    end if;

    if pg_catalog.jsonb_typeof(
         v_performance_input -> 'exercises'
       ) <> 'array' then
      raise exception
        'GENESIS_TRAINING_SESSION_PERFORMANCE_INVALID';
    end if;

    if pg_catalog.jsonb_array_length(
         v_performance_input -> 'exercises'
       ) > 50 then
      raise exception
        'GENESIS_TRAINING_SESSION_PERFORMANCE_INVALID';
    end if;

    if pg_catalog.jsonb_typeof(
         v_workout_snapshot -> 'exercises'
       ) <> 'array' then
      raise exception
        'GENESIS_TRAINING_SESSION_PLAN_INVALID';
    end if;

    for v_exercise in
      select value
      from pg_catalog.jsonb_array_elements(
        v_performance_input -> 'exercises'
      )
    loop

      if pg_catalog.jsonb_typeof(
           v_exercise
         ) <> 'object' then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_EXERCISE_INVALID';
      end if;

      if exists (
        select 1
        from pg_catalog.jsonb_object_keys(
          v_exercise
        ) as exercise_key(key_name)
        where exercise_key.key_name not in (
          'exercise_index',
          'sets'
        )
      ) then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_EXERCISE_INVALID';
      end if;

      if pg_catalog.jsonb_typeof(
           v_exercise -> 'exercise_index'
         ) <> 'number'
         or (
           v_exercise ->> 'exercise_index'
         ) !~ '^[0-9]+$' then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_EXERCISE_INVALID';
      end if;

      v_exercise_index :=
        (
          v_exercise ->> 'exercise_index'
        )::integer;

      if v_exercise_index = any(
           v_seen_exercise_indexes
         ) then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_EXERCISE_DUPLICATE';
      end if;

      v_seen_exercise_indexes :=
        pg_catalog.array_append(
          v_seen_exercise_indexes,
          v_exercise_index
        );

      v_snapshot_exercise :=
        (
          v_workout_snapshot -> 'exercises'
        ) -> v_exercise_index;

      if v_snapshot_exercise is null
         or pg_catalog.jsonb_typeof(
              v_snapshot_exercise
            ) <> 'object'
         or pg_catalog.btrim(
              coalesce(
                v_snapshot_exercise ->> 'name',
                ''
              )
            ) = '' then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_EXERCISE_INVALID';
      end if;

      if (
        v_snapshot_exercise ->> 'sets'
      ) !~ '^[0-9]+$' then
        raise exception
          'GENESIS_TRAINING_SESSION_PLAN_INVALID';
      end if;

      v_prescribed_sets :=
        (
          v_snapshot_exercise ->> 'sets'
        )::integer;

      if v_prescribed_sets not between 1 and 50 then
        raise exception
          'GENESIS_TRAINING_SESSION_PLAN_INVALID';
      end if;

      if pg_catalog.jsonb_typeof(
           v_exercise -> 'sets'
         ) <> 'array' then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_EXERCISE_INVALID';
      end if;

      if pg_catalog.jsonb_array_length(
           v_exercise -> 'sets'
         ) > v_prescribed_sets then
        raise exception
          'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
      end if;

      v_seen_set_numbers :=
        array[]::integer[];

      v_normalized_sets :=
        '[]'::jsonb;

      for v_set in
        select value
        from pg_catalog.jsonb_array_elements(
          v_exercise -> 'sets'
        )
      loop

        if pg_catalog.jsonb_typeof(
             v_set
           ) <> 'object' then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
        end if;

        if exists (
          select 1
          from pg_catalog.jsonb_object_keys(
            v_set
          ) as set_key(key_name)
          where set_key.key_name not in (
            'set_number',
            'weight',
            'reps',
            'rir'
          )
        ) then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
        end if;

        if pg_catalog.jsonb_typeof(
             v_set -> 'set_number'
           ) <> 'number'
           or (
             v_set ->> 'set_number'
           ) !~ '^[0-9]+$' then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
        end if;

        v_set_number :=
          (
            v_set ->> 'set_number'
          )::integer;

        if v_set_number not between 1 and v_prescribed_sets then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
        end if;

        if v_set_number = any(
             v_seen_set_numbers
           ) then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_DUPLICATE';
        end if;

        v_seen_set_numbers :=
          pg_catalog.array_append(
            v_seen_set_numbers,
            v_set_number
          );

        if pg_catalog.jsonb_typeof(
             v_set -> 'reps'
           ) <> 'number'
           or (
             v_set ->> 'reps'
           ) !~ '^[0-9]+$' then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
        end if;

        v_reps :=
          (
            v_set ->> 'reps'
          )::integer;

        if v_reps not between 0 and 1000 then
          raise exception
            'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
        end if;

        v_weight := null;

        if v_set ? 'weight'
           and v_set -> 'weight' <> 'null'::jsonb then

          if pg_catalog.jsonb_typeof(
               v_set -> 'weight'
             ) <> 'number' then
            raise exception
              'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
          end if;

          v_weight :=
            (
              v_set ->> 'weight'
            )::numeric;

          if v_weight < 0
             or v_weight > 5000 then
            raise exception
              'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
          end if;

        end if;

        v_rir := null;

        if v_set ? 'rir'
           and v_set -> 'rir' <> 'null'::jsonb then

          if pg_catalog.jsonb_typeof(
               v_set -> 'rir'
             ) <> 'number' then
            raise exception
              'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
          end if;

          v_rir :=
            (
              v_set ->> 'rir'
            )::numeric;

          if v_rir < 0
             or v_rir > 10 then
            raise exception
              'GENESIS_TRAINING_SESSION_PERFORMANCE_SET_INVALID';
          end if;

        end if;

        v_normalized_sets :=
          v_normalized_sets ||
          pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_strip_nulls(
              pg_catalog.jsonb_build_object(
                'set_number',
                v_set_number,
                'weight',
                v_weight,
                'reps',
                v_reps,
                'rir',
                v_rir
              )
            )
          );

      end loop;

      v_normalized_exercises :=
        v_normalized_exercises ||
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'exercise_index',
            v_exercise_index,

            'exercise_name',
            v_snapshot_exercise ->> 'name',

            'sets',
            v_normalized_sets
          )
        );

    end loop;

    v_performance_normalized :=
      pg_catalog.jsonb_build_object(
        'schema_version',
        1,

        'weight_unit',
        v_weight_unit,

        'exercises',
        v_normalized_exercises
      );

  end if;


  -- ==========================================================
  -- APPEND-ONLY SESSION PERSISTENCE
  -- ==========================================================

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
    v_performance_normalized,
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
    completed_at,
    performance_data
  into
    v_session_id,
    v_completed_at,
    v_stored_performance_data;

  if v_session_id is null then

    v_already_completed := true;

    select
      ats.id,
      ats.completed_at,
      ats.performance_data
    into
      v_session_id,
      v_completed_at,
      v_stored_performance_data
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
    v_already_completed,

    'performance_data',
    v_stored_performance_data
  );

end;
$$;


revoke all
on function
  private.genesis_athlete_complete_training_session_impl(
    integer,
    text,
    jsonb
  )
from public, anon, authenticated;

grant execute
on function
  private.genesis_athlete_complete_training_session_impl(
    integer,
    text,
    jsonb
  )
to authenticated;


-- ============================================================
-- PUBLIC DATA API SURFACE
-- ============================================================

create function
  public.genesis_athlete_complete_training_session(
    p_routine_day integer,
    p_time_zone text,
    p_performance_data jsonb default '{}'::jsonb
  )
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select
    private.genesis_athlete_complete_training_session_impl(
      p_routine_day,
      p_time_zone,
      p_performance_data
    );
$$;


revoke all
on function
  public.genesis_athlete_complete_training_session(
    integer,
    text,
    jsonb
  )
from public, anon, authenticated;

grant execute
on function
  public.genesis_athlete_complete_training_session(
    integer,
    text,
    jsonb
  )
to authenticated;


comment on function
  private.genesis_athlete_complete_training_session_impl(
    integer,
    text,
    jsonb
  )
is
  'Genesis Trainer Pro privileged server-authoritative completion implementation. Validates and canonicalizes athlete-reported per-set performance against the approved workout snapshot before append-only persistence.';


comment on function
  public.genesis_athlete_complete_training_session(
    integer,
    text,
    jsonb
  )
is
  'Genesis Trainer Pro authenticated SECURITY INVOKER completion RPC. Accepts routine day, IANA time zone and optional schema-versioned per-set performance data.';


comment on column
  public.athlete_training_sessions.performance_data
is
  'Immutable server-validated athlete-reported workout performance. Empty object represents a legacy completion without captured set performance.';