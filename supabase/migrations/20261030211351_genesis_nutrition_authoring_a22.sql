-- Genesis A2.2B: coach authoring, submission and review.
-- Payload only: generate migration filename with Supabase CLI after local PASS.
-- No activation, legacy import, athlete proposal or UI cutover.

alter table public.athlete_nutrition_plan_versions
  add column draft_revision integer not null default 1
  check (draft_revision between 1 and 1000000000);

-- All writes are serialized per program. This also prevents stale save/submit
-- races. Authorization is checked here even when invoked without a wrapper.
create function private.genesis_nutrition_write(
  p_action text, p_program_id uuid, p_version_id uuid,
  p_expected_revision integer, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_program public.athlete_programs%rowtype;
  v_athlete public.athletes_profile%rowtype;
  v_coach public.coaches_profile%rowtype;
  v_plan uuid;
  v_version public.athlete_nutrition_plan_versions%rowtype;
  v_id uuid;
  v_number integer;
  v_meal jsonb;
  v_item jsonb;
  v_meal_id uuid;
  v_decision text;
  v_note text;
begin
  if v_actor is null then raise exception 'GENESIS_NUTRITION_AUTH_REQUIRED'; end if;
  if p_action is null or p_action not in ('SAVE','SUBMIT','REVIEW') then
    raise exception 'GENESIS_NUTRITION_ACTION_INVALID';
  end if;

  -- Fail closed on missing, suspended or deleted canonical identity.
  select u.role::text into v_role from public.users_master u
  where u.id=v_actor and u.account_status::text='ACTIVE' for share;
  if v_role is null or v_role not in ('COACH','SUPER_ADMIN') then
    raise exception 'GENESIS_NUTRITION_ACTOR_FORBIDDEN';
  end if;
  select * into v_program from public.athlete_programs
  where id=p_program_id for update;
  if not found then raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN'; end if;
  select * into v_athlete from public.athletes_profile
  where id=v_program.athlete_id for share;
  if not found then raise exception 'GENESIS_NUTRITION_PROGRAM_FORBIDDEN'; end if;
  perform 1 from public.users_master
  where id=v_athlete.user_id and account_status::text='ACTIVE' for share;
  if not found then
    raise exception 'GENESIS_NUTRITION_ATHLETE_INACTIVE';
  end if;
  if v_role='COACH' then
    select * into v_coach from public.coaches_profile
    where id=v_program.coach_id for share;
    if not found or v_coach.user_id is distinct from v_actor
       or v_athlete.coach_id is distinct from v_coach.id
       or v_coach.b2b_plan not in ('EVOLUCION','ELITE')
       or v_coach.b2b_plan is null then
      raise exception 'GENESIS_NUTRITION_COACH_FORBIDDEN';
    end if;
  end if;
  if v_program.service_focus not in ('NUTRITION','BOTH')
     or v_program.service_focus is null
     or v_program.status not in ('SCHEDULED','ACTIVE')
     or v_program.status is null
     or v_program.ends_at is null or v_program.ends_at <= clock_timestamp() then
    raise exception 'GENESIS_NUTRITION_PROGRAM_NOT_WRITABLE';
  end if;

  select id into v_plan from public.athlete_nutrition_plans
  where program_id=p_program_id and athlete_id=v_program.athlete_id for update;
  if p_version_id is not null then
    select * into v_version from public.athlete_nutrition_plan_versions
    where id=p_version_id and plan_id=v_plan for update;
    if not found then raise exception 'GENESIS_NUTRITION_VERSION_FORBIDDEN'; end if;
    if p_expected_revision is null or p_expected_revision <> v_version.draft_revision then
      raise exception 'GENESIS_NUTRITION_STALE_REVISION';
    end if;
  elsif p_action <> 'SAVE' or p_expected_revision is not null then
    raise exception 'GENESIS_NUTRITION_VERSION_REQUIRED';
  end if;

  if p_action='SAVE' then
    if p_version_id is not null and v_version.status <> 'DRAFT' then
      raise exception 'GENESIS_NUTRITION_DRAFT_REQUIRED';
    end if;
    if jsonb_typeof(p_payload) is distinct from 'object'
       or octet_length(p_payload::text)>1048576 then
      raise exception 'GENESIS_NUTRITION_PAYLOAD_INVALID';
    end if;
    if exists (select 1 from jsonb_object_keys(p_payload) k where k not in
      ('title','time_zone','starts_on','ends_on','target_calories_kcal',
       'target_protein_g','target_carbs_g','target_fat_g','plan_note','meals')) then
      raise exception 'GENESIS_NUTRITION_PAYLOAD_FIELD_INVALID';
    end if;
    if jsonb_typeof(p_payload->'meals') is distinct from 'array' then
      raise exception 'GENESIS_NUTRITION_MEALS_INVALID';
    end if;
    if jsonb_array_length(p_payload->'meals')>60 then
      raise exception 'GENESIS_NUTRITION_MEALS_INVALID';
    end if;
    if v_plan is null then
      insert into public.athlete_nutrition_plans(athlete_id,program_id)
      values(v_program.athlete_id,p_program_id) returning id into v_plan;
    end if;
    if p_version_id is null then
      select coalesce(max(version_number),0)+1 into v_number
      from public.athlete_nutrition_plan_versions where plan_id=v_plan;
      insert into public.athlete_nutrition_plan_versions
        (plan_id,version_number,title,time_zone,authored_by)
      values(v_plan,v_number,p_payload->>'title',p_payload->>'time_zone',v_actor)
      returning * into v_version;
    end if;
    v_id := v_version.id;
    update public.athlete_nutrition_plan_versions set
      title=p_payload->>'title',time_zone=p_payload->>'time_zone',
      starts_on=(p_payload->>'starts_on')::date,
      ends_on=(p_payload->>'ends_on')::date,
      target_calories_kcal=(p_payload->>'target_calories_kcal')::numeric,
      target_protein_g=(p_payload->>'target_protein_g')::numeric,
      target_carbs_g=(p_payload->>'target_carbs_g')::numeric,
      target_fat_g=(p_payload->>'target_fat_g')::numeric,
      plan_note=coalesce(p_payload->>'plan_note',''),
      draft_revision=draft_revision+case when p_version_id is null then 0 else 1 end
    where id=v_id returning * into v_version;
    -- Complete replacement. Any invalid item rolls the whole call back.
    delete from public.athlete_nutrition_meals where version_id=v_id;
    for v_meal in select value from jsonb_array_elements(p_payload->'meals') loop
      if jsonb_typeof(v_meal) is distinct from 'object' then
        raise exception 'GENESIS_NUTRITION_MEAL_INVALID';
      end if;
      if exists (select 1 from jsonb_object_keys(v_meal) k where k not in
        ('day_type','meal_number','title','local_time','instructions','items')) then
        raise exception 'GENESIS_NUTRITION_MEAL_FIELD_INVALID';
      end if;
      if jsonb_typeof(v_meal->'items') is distinct from 'array' then
        raise exception 'GENESIS_NUTRITION_ITEMS_INVALID';
      end if;
      if jsonb_array_length(v_meal->'items')>100 then
        raise exception 'GENESIS_NUTRITION_ITEMS_INVALID';
      end if;
      insert into public.athlete_nutrition_meals
        (version_id,day_type,meal_number,title,local_time,instructions)
      values(v_id,coalesce(v_meal->>'day_type','EVERY_DAY'),
        (v_meal->>'meal_number')::integer,v_meal->>'title',
        (v_meal->>'local_time')::time,coalesce(v_meal->>'instructions',''))
      returning id into v_meal_id;
      for v_item in select value from jsonb_array_elements(v_meal->'items') loop
        if jsonb_typeof(v_item) is distinct from 'object' then
          raise exception 'GENESIS_NUTRITION_ITEM_INVALID';
        end if;
        if exists (select 1 from jsonb_object_keys(v_item) k where k not in
          ('position','food_name','quantity','quantity_unit','portion_description',
           'preparation','calories_kcal','protein_g','carbs_g','fat_g',
           'nutrient_source','source_reference')) then
          raise exception 'GENESIS_NUTRITION_ITEM_FIELD_INVALID';
        end if;
        insert into public.athlete_nutrition_meal_items
          (meal_id,position,food_name,quantity,quantity_unit,portion_description,
           preparation,calories_kcal,protein_g,carbs_g,fat_g,nutrient_source,source_reference)
        values(v_meal_id,(v_item->>'position')::integer,v_item->>'food_name',
          (v_item->>'quantity')::numeric,v_item->>'quantity_unit',
          v_item->>'portion_description',coalesce(v_item->>'preparation',''),
          (v_item->>'calories_kcal')::numeric,(v_item->>'protein_g')::numeric,
          (v_item->>'carbs_g')::numeric,(v_item->>'fat_g')::numeric,
          coalesce(v_item->>'nutrient_source','COACH_DECLARED'),v_item->>'source_reference');
      end loop;
    end loop;
  elsif p_action='SUBMIT' then
    if v_version.status <> 'DRAFT' then raise exception 'GENESIS_NUTRITION_DRAFT_REQUIRED'; end if;
    update public.athlete_nutrition_plan_versions
    set status='PENDING_REVIEW',submitted_at=clock_timestamp()
    where id=p_version_id returning * into v_version;
  else
    if v_version.status <> 'PENDING_REVIEW' then
      raise exception 'GENESIS_NUTRITION_PENDING_REQUIRED';
    end if;
    v_decision := p_payload->>'decision';
    v_note := btrim(p_payload->>'note');
    if v_decision is null or v_decision not in ('APPROVED','REJECTED')
       or v_note is null or length(v_note) not between 1 and 4000 then
      raise exception 'GENESIS_NUTRITION_REVIEW_INVALID';
    end if;
    update public.athlete_nutrition_plan_versions set
      status=v_decision,reviewed_by=v_actor,reviewed_at=clock_timestamp(),review_note=v_note
    where id=p_version_id returning * into v_version;
  end if;
  return jsonb_build_object('plan_id',v_plan,'version_id',v_version.id,
    'version_number',v_version.version_number,'draft_revision',v_version.draft_revision,
    'status',v_version.status);
end;
$function$;

-- Public entry points are INVOKER. The private implementation authorizes every
-- call independently; private schema must remain outside exposed API schemas.
create function public.genesis_save_nutrition_draft(
  p_program_id uuid,p_version_id uuid,p_expected_revision integer,p_payload jsonb
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.genesis_nutrition_write('SAVE',p_program_id,p_version_id,p_expected_revision,p_payload);
$function$;
create function public.genesis_submit_nutrition_draft(
  p_program_id uuid,p_version_id uuid,p_expected_revision integer
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.genesis_nutrition_write('SUBMIT',p_program_id,p_version_id,p_expected_revision,null);
$function$;
create function public.genesis_review_nutrition_version(
  p_program_id uuid,p_version_id uuid,p_expected_revision integer,p_decision text,p_note text
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.genesis_nutrition_write('REVIEW',p_program_id,p_version_id,p_expected_revision,
    jsonb_build_object('decision',p_decision,'note',p_note));
$function$;

revoke all on function private.genesis_nutrition_write(text,uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.genesis_save_nutrition_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.genesis_submit_nutrition_draft(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.genesis_review_nutrition_version(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.genesis_nutrition_write(text,uuid,uuid,integer,jsonb) to authenticated;
grant execute on function public.genesis_save_nutrition_draft(uuid,uuid,integer,jsonb) to authenticated;
grant execute on function public.genesis_submit_nutrition_draft(uuid,uuid,integer) to authenticated;
grant execute on function public.genesis_review_nutrition_version(uuid,uuid,integer,text,text) to authenticated;
