-- Genesis OS 002B4.B.1
-- Canonical daily discipline pipeline.
-- One authenticated athlete check-in atomically writes:
--   1) public.daily_logs historical record (one row per UTC day)
--   2) public.athletes_profile.discipline_metrics current snapshot
-- Manual self-reported habits remain separate from wearable telemetry.

-- A missing compliance score must mean "not evaluated yet", not 0%.
alter table public.daily_logs
  alter column compliance_score drop default;

create or replace function public.save_daily_discipline_checkin(
  p_payload jsonb
)
returns table (
  log_date date,
  saved_at timestamptz,
  athlete_profile_id uuid,
  saved_payload jsonb
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_athlete_id uuid;
  v_now timestamptz;
  v_today date;

  v_water_text text;
  v_sleep_text text;
  v_steps_text text;
  v_water numeric;
  v_sleep numeric;
  v_steps integer;

  v_training_status text;
  v_difficulty_note text;

  v_meal jsonb;
  v_meals jsonb := '[]'::jsonb;
  v_meal_num integer;
  v_meal_status text;
  v_photo_url text;
  v_seen_meals integer[] := array[]::integer[];

  v_normalized jsonb;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'GENESIS_DISCIPLINE: authentication required';
  end if;

  if not exists (
    select 1
    from public.users_master um
    where um.id = v_uid
      and um.role::text = 'ATHLETE'
      and um.account_status::text = 'ACTIVE'
  ) then
    raise exception 'GENESIS_DISCIPLINE: active athlete identity required';
  end if;

  select ap.id
    into v_athlete_id
  from public.athletes_profile ap
  where ap.user_id = v_uid
  limit 1;

  if v_athlete_id is null then
    raise exception 'GENESIS_DISCIPLINE: athlete profile not found';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'GENESIS_DISCIPLINE: payload must be a JSON object';
  end if;

  if pg_column_size(p_payload) > 32768 then
    raise exception 'GENESIS_DISCIPLINE: payload too large';
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'metrics', '{}'::jsonb)) <> 'object' then
    raise exception 'GENESIS_DISCIPLINE: metrics must be an object';
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'training', '{}'::jsonb)) <> 'object' then
    raise exception 'GENESIS_DISCIPLINE: training must be an object';
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'meals', '[]'::jsonb)) <> 'array' then
    raise exception 'GENESIS_DISCIPLINE: meals must be an array';
  end if;

  -- ----------------------------------------------------------
  -- Manual metrics validation
  -- ----------------------------------------------------------

  v_water_text := nullif(trim(p_payload #>> '{metrics,water}'), '');
  v_sleep_text := nullif(trim(p_payload #>> '{metrics,sleep}'), '');
  v_steps_text := nullif(trim(p_payload #>> '{metrics,steps}'), '');

  if v_water_text is null
     or v_water_text !~ '^[0-9]+([.][0-9]+)?$'
  then
    raise exception 'GENESIS_DISCIPLINE: water must be numeric';
  end if;

  if v_sleep_text is null
     or v_sleep_text !~ '^[0-9]+([.][0-9]+)?$'
  then
    raise exception 'GENESIS_DISCIPLINE: sleep must be numeric';
  end if;

  if v_steps_text is null
     or v_steps_text !~ '^[0-9]+$'
  then
    raise exception 'GENESIS_DISCIPLINE: steps must be a whole number';
  end if;

  v_water := v_water_text::numeric;
  v_sleep := v_sleep_text::numeric;
  v_steps := v_steps_text::integer;

  if v_water < 0 or v_water > 20 then
    raise exception 'GENESIS_DISCIPLINE: water outside accepted range 0..20 L';
  end if;

  if v_sleep < 0 or v_sleep > 24 then
    raise exception 'GENESIS_DISCIPLINE: sleep outside accepted range 0..24 h';
  end if;

  if v_steps < 0 or v_steps > 200000 then
    raise exception 'GENESIS_DISCIPLINE: steps outside accepted range 0..200000';
  end if;

  -- ----------------------------------------------------------
  -- Training validation
  -- ----------------------------------------------------------

  v_training_status := upper(trim(coalesce(
    p_payload #>> '{training,completed}',
    ''
  )));

  if v_training_status not in ('YES', 'PARTIAL', 'NO') then
    raise exception 'GENESIS_DISCIPLINE: invalid training completion status';
  end if;

  v_difficulty_note := nullif(trim(coalesce(
    p_payload #>> '{training,difficulty_note}',
    ''
  )), '');

  if length(coalesce(v_difficulty_note, '')) > 1000 then
    raise exception 'GENESIS_DISCIPLINE: difficulty note too long';
  end if;

  -- ----------------------------------------------------------
  -- Meal evidence validation + normalization
  -- ----------------------------------------------------------

  if jsonb_array_length(coalesce(p_payload -> 'meals', '[]'::jsonb)) <> 5 then
    raise exception 'GENESIS_DISCIPLINE: exactly 5 meal records are required';
  end if;

  for v_meal in
    select value
    from jsonb_array_elements(p_payload -> 'meals')
  loop
    if jsonb_typeof(v_meal) <> 'object' then
      raise exception 'GENESIS_DISCIPLINE: each meal must be an object';
    end if;

    begin
      v_meal_num := (v_meal ->> 'meal_num')::integer;
    exception
      when others then
        raise exception 'GENESIS_DISCIPLINE: invalid meal number';
    end;

    if v_meal_num < 1 or v_meal_num > 5 then
      raise exception 'GENESIS_DISCIPLINE: meal number outside 1..5';
    end if;

    if v_meal_num = any(v_seen_meals) then
      raise exception 'GENESIS_DISCIPLINE: duplicate meal number %', v_meal_num;
    end if;

    v_seen_meals := array_append(v_seen_meals, v_meal_num);

    v_meal_status := upper(trim(coalesce(v_meal ->> 'status', 'PENDING')));

    if v_meal_status not in ('YES', 'PARTIAL', 'NO', 'PENDING') then
      raise exception 'GENESIS_DISCIPLINE: invalid meal status';
    end if;

    v_photo_url := nullif(trim(coalesce(v_meal ->> 'photo_url', '')), '');

    if length(coalesce(v_photo_url, '')) > 2048 then
      raise exception 'GENESIS_DISCIPLINE: meal photo URL too long';
    end if;

    v_meals := v_meals || jsonb_build_array(
      jsonb_build_object(
        'meal_num', v_meal_num,
        'status', v_meal_status,
        'photo_url', v_photo_url
      )
    );
  end loop;

  -- ----------------------------------------------------------
  -- Canonical server timestamp/date
  -- ----------------------------------------------------------

  v_now := clock_timestamp();
  v_today := timezone('utc', v_now)::date;

  v_normalized := jsonb_build_object(
    'schema_version', 1,
    'source', 'MANUAL_DISCIPLINE',
    'metrics', jsonb_build_object(
      'water', v_water,
      'sleep', v_sleep,
      'steps', v_steps
    ),
    'training', jsonb_build_object(
      'completed', v_training_status,
      'difficulty_note', v_difficulty_note
    ),
    'meals', v_meals,
    'last_updated', v_now
  );

  -- ----------------------------------------------------------
  -- Canonical historical row.
  -- compliance_score remains NULL until the explicit Genesis
  -- compliance rules engine is defined in 002B4.B.2.
  -- ----------------------------------------------------------

  insert into public.daily_logs (
    user_id,
    log_date,
    compliance_score,
    habits_data
  )
  values (
    v_uid,
    v_today,
    null,
    v_normalized
  )
  on conflict (user_id, log_date)
  do update set
    compliance_score = null,
    habits_data = excluded.habits_data;

  -- Current-state cache for existing UI/coach views.
  update public.athletes_profile
  set discipline_metrics = v_normalized
  where id = v_athlete_id;

  return query
  select
    v_today,
    v_now,
    v_athlete_id,
    v_normalized;
end;
$$;

revoke all on function public.save_daily_discipline_checkin(jsonb)
from public, anon;

grant execute on function public.save_daily_discipline_checkin(jsonb)
to authenticated;

comment on function public.save_daily_discipline_checkin(jsonb) is
'Genesis 002B4.B.1: authenticated athlete daily discipline check-in. Atomically writes daily_logs history and athletes_profile current snapshot; manual self-report is kept separate from wearable telemetry.';
