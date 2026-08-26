-- Genesis OS 002B5.A2B2A
-- Canonical private meal evidence paths for manual discipline check-ins.
--
-- GOALS:
--   1) Stop persisting permanent public meal URLs in daily_logs / discipline_metrics.
--   2) Persist only bucket-relative photo_path values.
--   3) Accept legacy public athlete_evidence URLs during transition and normalize them.
--   4) Verify every referenced meal object belongs to the authenticated athlete path.
--   5) Verify referenced objects physically exist in athlete_evidence.
--   6) Preserve validated IANA timezone + canonical local-day behavior from 002B4.B.1B.

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
set search_path = public, private, storage, pg_temp
as $$
declare
  v_uid uuid;
  v_athlete_id uuid;
  v_now timestamptz;
  v_today date;
  v_time_zone text;

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
  v_photo_path text;
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

  -- --------------------------------------------------------------------------
  -- Canonical local day.
  -- Browser supplies only an IANA timezone; PostgreSQL chooses log_date.
  -- --------------------------------------------------------------------------

  v_time_zone := nullif(trim(coalesce(p_payload ->> 'time_zone', '')), '');

  if v_time_zone is null then
    raise exception 'GENESIS_DISCIPLINE: time_zone is required';
  end if;

  if length(v_time_zone) > 100 then
    raise exception 'GENESIS_DISCIPLINE: invalid time_zone';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names tz
    where tz.name = v_time_zone
  ) then
    raise exception 'GENESIS_DISCIPLINE: unsupported time_zone';
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

  -- --------------------------------------------------------------------------
  -- Manual metrics validation.
  -- --------------------------------------------------------------------------

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

  -- --------------------------------------------------------------------------
  -- Training validation.
  -- --------------------------------------------------------------------------

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

  -- --------------------------------------------------------------------------
  -- Meal evidence validation + canonical private-path normalization.
  -- --------------------------------------------------------------------------

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

    -- Canonical client sends photo_path. Legacy clients may still send a public URL.
    v_photo_path := nullif(trim(coalesce(v_meal ->> 'photo_path', '')), '');
    v_photo_url := nullif(trim(coalesce(v_meal ->> 'photo_url', '')), '');

    if v_photo_path is null
       and v_photo_url is not null
       and v_photo_url like '%/storage/v1/object/public/athlete_evidence/%'
    then
      v_photo_path := split_part(
        v_photo_url,
        '/storage/v1/object/public/athlete_evidence/',
        2
      );
    end if;

    if v_photo_path is not null then
      if length(v_photo_path) > 1024
         or v_photo_path like '%://%'
         or v_photo_path like '/%'
      then
        raise exception 'GENESIS_DISCIPLINE: invalid meal photo path';
      end if;

      if private.athlete_id_from_evidence_object_name(v_photo_path)
         is distinct from v_athlete_id
      then
        raise exception 'GENESIS_DISCIPLINE: meal photo path is outside athlete scope';
      end if;

      if not exists (
        select 1
        from storage.objects so
        where so.bucket_id = 'athlete_evidence'
          and so.name = v_photo_path
      ) then
        raise exception 'GENESIS_DISCIPLINE: meal photo object does not exist';
      end if;
    end if;

    v_meals := v_meals || jsonb_build_array(
      jsonb_build_object(
        'meal_num', v_meal_num,
        'status', v_meal_status,
        'photo_path', v_photo_path
      )
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- Server timestamp + validated local date.
  -- --------------------------------------------------------------------------

  v_now := clock_timestamp();
  v_today := timezone(v_time_zone, v_now)::date;

  v_normalized := jsonb_build_object(
    'schema_version', 3,
    'source', 'MANUAL_DISCIPLINE',
    'time_zone', v_time_zone,
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
  on conflict on constraint daily_logs_user_id_log_date_key
  do update set
    compliance_score = null,
    habits_data = excluded.habits_data;

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
'Genesis 002B5.A2B2A: authenticated athlete discipline check-in stores meal evidence only as authorized athlete_evidence bucket-relative photo_path values. Legacy public URLs are normalized during transition; server validates object scope and existence.';
