-- Genesis A2.3A: authorized selection and effective nutrition reads.
-- Generate the migration filename with Supabase CLI after local validation.
-- active_version_id means SELECTED, not necessarily effective at this instant.

alter table public.athlete_nutrition_plans
  add column selection_revision integer not null default 0
    check (selection_revision between 0 and 1000000000),
  add column selected_by uuid references public.users_master(id) on delete set null,
  add column selected_at timestamptz;
create index athlete_nutrition_plans_selected_by_idx
  on public.athlete_nutrition_plans(selected_by) where selected_by is not null;

create function private.genesis_nutrition_select(
  p_program_id uuid, p_version_id uuid, p_expected_selection_revision integer
) returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_program public.athlete_programs%rowtype;
  v_athlete public.athletes_profile%rowtype;
  v_coach public.coaches_profile%rowtype;
  v_plan public.athlete_nutrition_plans%rowtype;
  v_version public.athlete_nutrition_plan_versions%rowtype;
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'GENESIS_NUTRITION_AUTH_REQUIRED'; end if;
  -- Match A2.2 lock order: actor, program, athlete, athlete user, coach, plan.
  select role::text into v_role from public.users_master
    where id=v_actor and account_status::text='ACTIVE' for share;
  if v_role is null or v_role not in ('COACH','SUPER_ADMIN') then
    raise exception 'GENESIS_NUTRITION_ACTOR_FORBIDDEN';
  end if;
  select * into v_program from public.athlete_programs where id=p_program_id for update;
  if not found then raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN'; end if;
  select * into v_athlete from public.athletes_profile where id=v_program.athlete_id for share;
  if not found then raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN'; end if;
  perform 1 from public.users_master where id=v_athlete.user_id
    and account_status::text='ACTIVE' for share;
  if not found then raise exception 'GENESIS_NUTRITION_ATHLETE_INACTIVE'; end if;
  if v_role='COACH' then
    select * into v_coach from public.coaches_profile where id=v_program.coach_id for share;
    if not found or v_coach.user_id is distinct from v_actor
       or v_athlete.coach_id is distinct from v_coach.id
       or v_coach.b2b_plan is null or v_coach.b2b_plan not in ('EVOLUCION','ELITE') then
      raise exception 'GENESIS_NUTRITION_COACH_FORBIDDEN';
    end if;
  end if;
  -- Use wall clock AFTER acquiring locks; a waiting call cannot select after expiry.
  v_now := clock_timestamp();
  if v_program.service_focus is null or v_program.service_focus not in ('NUTRITION','BOTH')
     or v_program.status is null or v_program.status not in ('SCHEDULED','ACTIVE')
     or v_program.starts_at is null or v_program.ends_at is null
     or v_program.ends_at <= v_now then
    raise exception 'GENESIS_NUTRITION_PROGRAM_NOT_WRITABLE';
  end if;
  select * into v_plan from public.athlete_nutrition_plans
    where program_id=p_program_id and athlete_id=v_program.athlete_id for update;
  if not found then raise exception 'GENESIS_NUTRITION_PLAN_REQUIRED'; end if;
  if p_expected_selection_revision is distinct from v_plan.selection_revision then
    raise exception 'GENESIS_NUTRITION_STALE_SELECTION';
  end if;
  select * into v_version from public.athlete_nutrition_plan_versions
    where id=p_version_id and plan_id=v_plan.id for share;
  if not found then raise exception 'GENESIS_NUTRITION_VERSION_FORBIDDEN'; end if;
  if v_version.status <> 'APPROVED' then
    raise exception 'GENESIS_NUTRITION_APPROVED_REQUIRED';
  end if;
  if v_version.ends_on is not null
     and v_version.ends_on <= (v_now at time zone v_version.time_zone)::date then
    raise exception 'GENESIS_NUTRITION_VERSION_EXPIRED';
  end if;
  -- Half-open windows must overlap. A version may extend past the program;
  -- the read contract always clips effectiveness to the program's window.
  if (v_version.starts_on::timestamp at time zone v_version.time_zone) >= v_program.ends_at
     or (v_version.ends_on is not null and
       (v_version.ends_on::timestamp at time zone v_version.time_zone) <= v_program.starts_at) then
    raise exception 'GENESIS_NUTRITION_VERSION_OUTSIDE_PROGRAM';
  end if;
  if v_plan.active_version_id is distinct from p_version_id then
    update public.athlete_nutrition_plans
      set active_version_id=p_version_id, selection_revision=selection_revision+1,
          selected_by=v_actor, selected_at=v_now
      where id=v_plan.id returning * into v_plan;
  end if;
  return jsonb_build_object('plan_id',v_plan.id,'program_id',p_program_id,
    'selected_version_id',v_plan.active_version_id,'selection_revision',v_plan.selection_revision,
    'selected_by',v_plan.selected_by,'selected_at',v_plan.selected_at);
end;
$function$;

-- Pure internal clock logic, deliberately not executable by browser roles.
-- A scheduled program becomes effective at starts_at without a status cron.
create function private.genesis_nutrition_effective_state(
  p_status text,p_program_start timestamptz,p_program_end timestamptz,
  p_version_start date,p_version_end date,p_time_zone text,p_at timestamptz
) returns text language sql stable security invoker set search_path = ''
as $function$
  select case
    when p_status='CANCELLED' then 'PROGRAM_CANCELLED'
    when p_status='EXPIRED' then 'PROGRAM_EXPIRED'
    when p_status='PAUSED' then 'PROGRAM_PAUSED'
    when p_status='PENDING_ACTIVATION' then 'PROGRAM_PENDING'
    when p_status is null or p_status not in ('ACTIVE','SCHEDULED')
      or p_program_start is null or p_program_end is null or p_at is null
      or p_program_end<=p_program_start then 'PROGRAM_UNAVAILABLE'
    when p_at>=p_program_end then 'PROGRAM_EXPIRED'
    when p_at<p_program_start then 'PROGRAM_SCHEDULED'
    when p_version_start is null or p_time_zone is null then 'NO_SELECTION'
    when (p_at at time zone p_time_zone)::date<p_version_start then 'VERSION_SCHEDULED'
    when p_version_end is not null and (p_at at time zone p_time_zone)::date>=p_version_end
      then 'VERSION_EXPIRED'
    else 'EFFECTIVE'
  end;
$function$;

create function private.genesis_nutrition_read(p_program_id uuid,p_day_type text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_program public.athlete_programs%rowtype;
  v_athlete public.athletes_profile%rowtype;
  v_plan public.athlete_nutrition_plans%rowtype;
  v_version public.athlete_nutrition_plan_versions%rowtype;
  v_now timestamptz := statement_timestamp();
  v_state text;
  v_day_type text;
  v_meals jsonb := '[]'::jsonb;
  v_effective jsonb := null;
begin
  if v_actor is null then raise exception 'GENESIS_NUTRITION_AUTH_REQUIRED'; end if;
  select role::text into v_role from public.users_master
    where id=v_actor and account_status::text='ACTIVE';
  if v_role is null then raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN'; end if;
  select * into v_program from public.athlete_programs where id=p_program_id;
  if not found then raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN'; end if;
  select * into v_athlete from public.athletes_profile where id=v_program.athlete_id;
  if not found or not exists (select 1 from public.users_master
      where id=v_athlete.user_id and account_status::text='ACTIVE') then
    raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN';
  end if;
  if not (v_role='SUPER_ADMIN'
    or (v_role in ('ATHLETE','COACH') and v_athlete.user_id=v_actor)
    or (v_role='COACH' and exists (select 1 from public.coaches_profile c
      where c.id=v_program.coach_id and c.id=v_athlete.coach_id and c.user_id=v_actor
      and c.b2b_plan in ('IGNICION','EVOLUCION','ELITE')))) then
    raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN';
  end if;
  if p_day_type is null or p_day_type not in ('EVERY_DAY','TRAINING_DAY','REST_DAY') then
    raise exception 'GENESIS_NUTRITION_DAY_TYPE_INVALID';
  end if;
  if v_program.service_focus is null or v_program.service_focus not in ('NUTRITION','BOTH') then
    return jsonb_build_object('program_id',p_program_id,'state','PROGRAM_NOT_NUTRITION',
      'evaluated_at',v_now,'effective_plan',null);
  end if;
  select * into v_plan from public.athlete_nutrition_plans
    where program_id=p_program_id and athlete_id=v_program.athlete_id;
  select * into v_version from public.athlete_nutrition_plan_versions
    where id=v_plan.active_version_id and plan_id=v_plan.id and status='APPROVED';
  v_state := private.genesis_nutrition_effective_state(v_program.status::text,
    v_program.starts_at,v_program.ends_at,v_version.starts_on,v_version.ends_on,
    v_version.time_zone,v_now);
  if v_state='NO_SELECTION' and v_plan.id is null then v_state := 'NO_PLAN'; end if;
  if v_state='EFFECTIVE' then
    -- A caller supplies the day classification; this does not assert training
    -- was performed. Use the complete matching set, otherwise EVERY_DAY.
    v_day_type := case when exists(select 1 from public.athlete_nutrition_meals
      where version_id=v_version.id and day_type=p_day_type) then p_day_type else 'EVERY_DAY' end;
    select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('items',
      (select coalesce(jsonb_agg(to_jsonb(i) order by i.position),'[]'::jsonb)
       from public.athlete_nutrition_meal_items i where i.meal_id=m.id))
      order by m.meal_number),'[]'::jsonb) into v_meals
    from public.athlete_nutrition_meals m where m.version_id=v_version.id and m.day_type=v_day_type;
    if jsonb_array_length(v_meals)=0 then
      v_state := 'NO_MEALS_FOR_DAY';
    else
      v_effective := jsonb_build_object('version_id',v_version.id,
        'version_number',v_version.version_number,'title',v_version.title,
        'time_zone',v_version.time_zone,'local_date',(v_now at time zone v_version.time_zone)::date,
        'starts_on',v_version.starts_on,'ends_on',v_version.ends_on,
        'target_calories_kcal',v_version.target_calories_kcal,
        'target_protein_g',v_version.target_protein_g,'target_carbs_g',v_version.target_carbs_g,
        'target_fat_g',v_version.target_fat_g,'plan_note',v_version.plan_note,
        'resolved_day_type',v_day_type,'meals',v_meals);
    end if;
  end if;
  return jsonb_build_object('program_id',p_program_id,'plan_id',v_plan.id,'state',v_state,
    'evaluated_at',v_now,'program_status',v_program.status,
    'program_starts_at',v_program.starts_at,'program_ends_at',v_program.ends_at,
    'selected_version_id',v_version.id,'selection_revision',v_plan.selection_revision,
    'selected_starts_on',v_version.starts_on,'selected_ends_on',v_version.ends_on,
    'selected_time_zone',v_version.time_zone,'requested_day_type',p_day_type,
    'effective_plan',v_effective);
end;
$function$;

create function public.genesis_select_nutrition_version(
  p_program_id uuid,p_version_id uuid,p_expected_selection_revision integer
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.genesis_nutrition_select(p_program_id,p_version_id,p_expected_selection_revision);
$function$;
create function public.genesis_get_effective_nutrition_plan(p_program_id uuid,p_day_type text)
returns jsonb language sql stable security invoker set search_path = ''
as $function$
  select private.genesis_nutrition_read(p_program_id,p_day_type);
$function$;

revoke all on function private.genesis_nutrition_select(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function private.genesis_nutrition_read(uuid,text) from public,anon,authenticated;
revoke all on function private.genesis_nutrition_effective_state(text,timestamptz,timestamptz,date,date,text,timestamptz) from public,anon,authenticated;
revoke all on function public.genesis_select_nutrition_version(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.genesis_get_effective_nutrition_plan(uuid,text) from public,anon,authenticated;
grant execute on function private.genesis_nutrition_select(uuid,uuid,integer) to authenticated;
grant execute on function private.genesis_nutrition_read(uuid,text) to authenticated;
grant execute on function public.genesis_select_nutrition_version(uuid,uuid,integer) to authenticated;
grant execute on function public.genesis_get_effective_nutrition_plan(uuid,text) to authenticated;
