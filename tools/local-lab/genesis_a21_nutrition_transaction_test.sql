-- Genesis A2.1B.2 R1 - local integration test, always rolled back.
-- Run only through docker exec against supabase_db_genesis-local-lab.
-- The PowerShell runner inserts the hash-verified migration at the marker.
-- All fixture edits and new domain objects are inside one transaction.

\set ON_ERROR_STOP on

create temporary table genesis_a21_baseline (snapshot jsonb)
  on commit preserve rows;

create function pg_temp.genesis_a21_snapshot()
returns jsonb language sql stable set search_path = '' as $function$
  select jsonb_build_object(
    'users', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.users_master t),
    'coaches', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.coaches_profile t),
    'profiles', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.athletes_profile t),
    'programs', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.athlete_programs t),
    'sessions', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.athlete_training_sessions t),
    'logs', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.daily_logs t),
    'metrics', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.athlete_daily_metrics t)
  );
$function$;

insert into genesis_a21_baseline values (pg_temp.genesis_a21_snapshot());

create function pg_temp.genesis_a21_expect_error(p_label text, p_sql text, p_pattern text)
returns void language plpgsql set search_path = '' as $function$
declare v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    if (sqlstate || ' ' || sqlerrm) !~ p_pattern then raise; end if;
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'GENESIS_A21B2R1_EXPECTED_REJECTION_MISSING: %', p_label;
  end if;
  raise notice 'PASS %', p_label;
end;
$function$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if current_database() <> 'postgres'
     or current_setting('server_version_num')::integer not between 170000 and 179999
     or (select count(*) from public.users_master) <> 3
     or (select count(*) from public.athletes_profile) <> 2
     or (select count(*) from public.athlete_programs) <> 1
     or (select count(*) from public.athlete_training_sessions) <> 1 then
    raise exception 'GENESIS_A21B2R1_LOCAL_BASELINE_CHANGED';
  end if;
  if to_regclass('public.athlete_nutrition_plans') is not null
     or to_regclass('public.athlete_nutrition_plan_versions') is not null
     or to_regclass('public.athlete_nutrition_meals') is not null
     or to_regclass('public.athlete_nutrition_meal_items') is not null then
    raise exception 'GENESIS_A21B2R1_NUTRITION_ALREADY_PRESENT';
  end if;
end;
$preflight$;

-- GENESIS_A21_MIGRATION_INSERTION_POINT

do $fixtures$
declare
  v_program public.athlete_programs%rowtype;
  v_owner uuid;
  v_other_uid uuid;
  v_other_profile uuid;
  v_coach_uid uuid;
  v_plan uuid := gen_random_uuid();
  v_other_plan uuid := gen_random_uuid();
  v_other_program uuid := gen_random_uuid();
  v_draft uuid := gen_random_uuid();
  v_approved uuid := gen_random_uuid();
  v_other_version uuid := gen_random_uuid();
  v_draft_meal uuid := gen_random_uuid();
  v_approved_meal uuid := gen_random_uuid();
  v_other_meal uuid := gen_random_uuid();
  v_draft_item uuid := gen_random_uuid();
  v_approved_item uuid := gen_random_uuid();
begin
  select * into strict v_program from public.athlete_programs;
  select a.user_id into v_owner
  from public.athletes_profile a join public.users_master u on u.id=a.user_id
  where a.id=v_program.athlete_id and u.role::text='ATHLETE'
    and u.account_status::text='ACTIVE';

  select a.id,a.user_id into v_other_profile,v_other_uid
  from public.athletes_profile a join public.users_master u on u.id=a.user_id
  where a.id<>v_program.athlete_id and u.role::text='ATHLETE'
    and u.account_status::text='ACTIVE';

  select c.user_id into v_coach_uid
  from public.coaches_profile c join public.users_master u on u.id=c.user_id
  join public.athletes_profile a on a.coach_id=c.id
  where c.id=v_program.coach_id and a.id=v_program.athlete_id
    and u.role::text='COACH' and u.account_status::text='ACTIVE'
    and c.b2b_plan in ('IGNICION','EVOLUCION','ELITE');

  if v_owner is null or v_other_uid is null or v_coach_uid is null then
    raise exception 'GENESIS_A21B2R1_LOCAL_TEST_IDENTITIES_REQUIRED';
  end if;

  -- Temporary adaptation of the existing TRAINING-only fixture. This is
  -- rolled back and does not activate or modify any remote athlete program.
  update public.athlete_programs
  set service_focus='BOTH',package_tier='ELITE' where id=v_program.id;

  -- A closed program avoids the existing one-open-program-per-athlete index.
  insert into public.athlete_programs
  select (jsonb_populate_record(null::public.athlete_programs,
    to_jsonb(p) || jsonb_build_object(
      'id',v_other_program,'athlete_id',v_other_profile,
      'status','EXPIRED','service_focus','BOTH','package_tier','ELITE'
    ))).* from public.athlete_programs p where p.id=v_program.id;

  insert into public.athlete_nutrition_plans(id,athlete_id,program_id)
  values (v_plan,v_program.athlete_id,v_program.id),
         (v_other_plan,v_other_profile,v_other_program);

  insert into public.athlete_nutrition_plan_versions
    (id,plan_id,version_number,title,time_zone,starts_on,
     target_calories_kcal,target_protein_g,target_carbs_g,target_fat_g,authored_by)
  values
    (v_draft,v_plan,1,'Local test draft','America/New_York',current_date,2020,120,250,60,v_coach_uid),
    (v_approved,v_plan,2,'Local test approved','America/New_York',current_date,2020,120,250,60,v_coach_uid),
    (v_other_version,v_other_plan,1,'Other athlete test','America/New_York',current_date,2020,120,250,60,v_coach_uid);

  insert into public.athlete_nutrition_meals(id,version_id,meal_number,title)
  values (v_draft_meal,v_draft,1,'Test meal'),
         (v_approved_meal,v_approved,1,'Test meal'),
         (v_other_meal,v_other_version,1,'Test meal');

  insert into public.athlete_nutrition_meal_items
    (id,meal_id,position,food_name,quantity,quantity_unit)
  values (v_draft_item,v_draft_meal,1,'Synthetic test item',100,'G'),
         (v_approved_item,v_approved_meal,1,'Synthetic test item',100,'G'),
         (gen_random_uuid(),v_other_meal,1,'Synthetic test item',100,'G');

  update public.athlete_nutrition_plan_versions
  set status='PENDING_REVIEW',submitted_at=now()
  where id in (v_approved,v_other_version);
  update public.athlete_nutrition_plan_versions
  set status='APPROVED',reviewed_at=now(),reviewed_by=v_coach_uid
  where id in (v_approved,v_other_version);

  update public.athlete_nutrition_plans set active_version_id=v_approved where id=v_plan;

  perform set_config('genesis_a21.owner_uid',v_owner::text,true);
  perform set_config('genesis_a21.other_uid',v_other_uid::text,true);
  perform set_config('genesis_a21.coach_uid',v_coach_uid::text,true);
  perform set_config('genesis_a21.coach_profile_id',v_program.coach_id::text,true);
  perform set_config('genesis_a21.original_coach_plan',
    (select b2b_plan from public.coaches_profile where id=v_program.coach_id),true);
  perform set_config('genesis_a21.plan_id',v_plan::text,true);
  perform set_config('genesis_a21.other_plan_id',v_other_plan::text,true);
  perform set_config('genesis_a21.draft_id',v_draft::text,true);
  perform set_config('genesis_a21.approved_id',v_approved::text,true);
  perform set_config('genesis_a21.other_version_id',v_other_version::text,true);
  perform set_config('genesis_a21.draft_meal_id',v_draft_meal::text,true);
  perform set_config('genesis_a21.approved_meal_id',v_approved_meal::text,true);
  perform set_config('genesis_a21.draft_item_id',v_draft_item::text,true);
  perform set_config('genesis_a21.approved_item_id',v_approved_item::text,true);
  raise notice 'PASS real local dependencies and review transitions';
end;
$fixtures$;

do $invariants$
declare
  v_draft uuid := current_setting('genesis_a21.draft_id')::uuid;
  v_approved uuid := current_setting('genesis_a21.approved_id')::uuid;
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in (
        'athlete_nutrition_plans','athlete_nutrition_plan_versions',
        'athlete_nutrition_meals','athlete_nutrition_meal_items') and c.relrowsecurity) <> 4 then
    raise exception 'GENESIS_A21B2R1_RLS_MISSING';
  end if;
  if exists (select 1 from information_schema.table_privileges
      where table_schema='public' and table_name in (
        'athlete_nutrition_plans','athlete_nutrition_plan_versions',
        'athlete_nutrition_meals','athlete_nutrition_meal_items')
      and ((grantee='authenticated' and privilege_type<>'SELECT')
        or grantee in ('anon','PUBLIC'))) then
    raise exception 'GENESIS_A21B2R1_GRANTS_INVALID';
  end if;
  if has_function_privilege('anon','private.genesis_nutrition_access_scope(uuid)','EXECUTE') then
    raise exception 'GENESIS_A21B2R1_ANON_HELPER_EXPOSED';
  end if;
  raise notice 'PASS real Supabase RLS and grants';

  perform pg_temp.genesis_a21_expect_error('approved version immutable',
    format('update public.athlete_nutrition_plan_versions set title=%L where id=%L','Changed',v_approved),
    'GENESIS_NUTRITION_REVIEWED_VERSION_IMMUTABLE');
  perform pg_temp.genesis_a21_expect_error('approved item immutable',
    format('update public.athlete_nutrition_meal_items set quantity=200 where id=%L',current_setting('genesis_a21.approved_item_id')),
    'GENESIS_NUTRITION_MEAL_CONTENT_IMMUTABLE');
  perform pg_temp.genesis_a21_expect_error('draft cannot be selected as active',
    format('update public.athlete_nutrition_plans set active_version_id=%L where id=%L',v_draft,current_setting('genesis_a21.plan_id')),
    'GENESIS_NUTRITION_ACTIVE_VERSION_INVALID');
  perform pg_temp.genesis_a21_expect_error('cross-plan active version rejected',
    format('update public.athlete_nutrition_plans set active_version_id=%L where id=%L',current_setting('genesis_a21.other_version_id'),current_setting('genesis_a21.plan_id')),
    'GENESIS_NUTRITION_ACTIVE_VERSION_INVALID');
  perform pg_temp.genesis_a21_expect_error('direct approval rejected',
    format('update public.athlete_nutrition_plan_versions set status=%L,submitted_at=now(),reviewed_at=now(),reviewed_by=%L where id=%L',
      'APPROVED',current_setting('genesis_a21.coach_uid'),v_draft),
    'GENESIS_NUTRITION_REVIEW_TRANSITION_INVALID');
  perform pg_temp.genesis_a21_expect_error('invalid numeric value rejected',
    format('update public.athlete_nutrition_meal_items set protein_g=%L where id=%L','NaN',current_setting('genesis_a21.draft_item_id')),
    '^23514 ');
end;
$invariants$;

do $owner_claims$
begin
  perform set_config('request.jwt.claim.sub',current_setting('genesis_a21.owner_uid'),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('genesis_a21.owner_uid'),'role','authenticated')::text,true);
end;
$owner_claims$;
set local role authenticated;
do $owner_rls$
begin
  if (select count(*) from public.athlete_nutrition_plans) <> 1
     or (select count(*) from public.athlete_nutrition_plan_versions) <> 1
     or (select count(*) from public.athlete_nutrition_meals) <> 1
     or (select count(*) from public.athlete_nutrition_meal_items) <> 1
     or not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.approved_id')::uuid)
     or exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.draft_id')::uuid) then
    raise exception 'GENESIS_A21B2R1_OWNER_VISIBILITY_FAILED';
  end if;
  raise notice 'PASS owner sees approved hierarchy, not draft or other athlete';
  begin
    update public.athlete_nutrition_plan_versions set title='Unauthorized'
    where id=current_setting('genesis_a21.approved_id')::uuid;
    raise exception 'GENESIS_A21B2R1_BROWSER_WRITE_ALLOWED';
  exception when insufficient_privilege then
    raise notice 'PASS browser write denied';
  end;
end;
$owner_rls$;
reset role;

do $other_claims$
begin
  perform set_config('request.jwt.claim.sub',current_setting('genesis_a21.other_uid'),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('genesis_a21.other_uid'),'role','authenticated')::text,true);
end;
$other_claims$;
set local role authenticated;
do $other_rls$
begin
  if exists (select 1 from public.athlete_nutrition_plans
       where id=current_setting('genesis_a21.plan_id')::uuid)
     or exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.approved_id')::uuid)
     or exists (select 1 from public.athlete_nutrition_meals
       where id=current_setting('genesis_a21.approved_meal_id')::uuid)
     or exists (select 1 from public.athlete_nutrition_meal_items
       where id=current_setting('genesis_a21.approved_item_id')::uuid)
     or not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.other_version_id')::uuid) then
    raise exception 'GENESIS_A21B2R1_OTHER_ATHLETE_ISOLATION_FAILED';
  end if;
  raise notice 'PASS second athlete isolated across the complete hierarchy';
end;
$other_rls$;
reset role;

do $coach_claims$
begin
  perform set_config('request.jwt.claim.sub',current_setting('genesis_a21.coach_uid'),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('genesis_a21.coach_uid'),'role','authenticated')::text,true);
end;
$coach_claims$;
set local role authenticated;
do $coach_rls$
begin
  if not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.approved_id')::uuid) then
    raise exception 'GENESIS_A21B2R1_COACH_APPROVED_READ_FAILED';
  end if;
  if current_setting('genesis_a21.original_coach_plan')='IGNICION' then
    if exists (select 1 from public.athlete_nutrition_plan_versions
         where id=current_setting('genesis_a21.draft_id')::uuid)
       or exists (select 1 from public.athlete_nutrition_meal_items
         where id=current_setting('genesis_a21.draft_item_id')::uuid) then
      raise exception 'GENESIS_A21B2R1_IGNICION_DRAFT_EXPOSED';
    end if;
    raise notice 'PASS original Ignicion coach sees approved content, not drafts';
  else
    if not exists (select 1 from public.athlete_nutrition_plan_versions
         where id=current_setting('genesis_a21.draft_id')::uuid) then
      raise exception 'GENESIS_A21B2R1_EDITOR_DRAFT_READ_FAILED';
    end if;
    raise notice 'PASS original authorized coach sees reviewable content';
  end if;
end;
$coach_rls$;
reset role;

-- Exercise both reviewer tiers only inside the rollback transaction.
-- The existing coach-plan synchronization trigger remains enabled.
update public.coaches_profile set b2b_plan='EVOLUCION'
where id=current_setting('genesis_a21.coach_profile_id')::uuid;
set local role authenticated;
do $evolucion_rls$
begin
  if not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.draft_id')::uuid)
     or not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.approved_id')::uuid)
     or not exists (select 1 from public.athlete_nutrition_meal_items
       where id=current_setting('genesis_a21.draft_item_id')::uuid) then
    raise exception 'GENESIS_A21B2R1_EVOLUCION_VISIBILITY_FAILED';
  end if;
  raise notice 'PASS temporary Evolucion tier sees reviewable hierarchy';
end;
$evolucion_rls$;
reset role;

update public.coaches_profile set b2b_plan='ELITE'
where id=current_setting('genesis_a21.coach_profile_id')::uuid;
set local role authenticated;
do $elite_rls$
begin
  if not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.draft_id')::uuid)
     or not exists (select 1 from public.athlete_nutrition_plan_versions
       where id=current_setting('genesis_a21.approved_id')::uuid)
     or not exists (select 1 from public.athlete_nutrition_meal_items
       where id=current_setting('genesis_a21.draft_item_id')::uuid) then
    raise exception 'GENESIS_A21B2R1_ELITE_VISIBILITY_FAILED';
  end if;
  begin
    update public.athlete_nutrition_plan_versions set title='Unauthorized'
    where id=current_setting('genesis_a21.draft_id')::uuid;
    raise exception 'GENESIS_A21B2R1_COACH_BROWSER_WRITE_ALLOWED';
  exception when insufficient_privilege then
    raise notice 'PASS Elite coach browser still cannot write directly';
  end;
  raise notice 'PASS temporary Elite tier sees reviewable hierarchy';
end;
$elite_rls$;
reset role;

update public.coaches_profile
set b2b_plan=current_setting('genesis_a21.original_coach_plan')
where id=current_setting('genesis_a21.coach_profile_id')::uuid;

do $anon_claims$
begin
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
end;
$anon_claims$;
set local role anon;
do $anon_rls$
begin
  begin
    perform 1 from public.athlete_nutrition_plans;
    raise exception 'GENESIS_A21B2R1_ANONYMOUS_READ_ALLOWED';
  exception when insufficient_privilege then
    raise notice 'PASS anonymous access denied';
  end;
end;
$anon_rls$;
reset role;

rollback;

do $rollback_check$
begin
  if to_regclass('public.athlete_nutrition_plans') is not null
     or to_regclass('public.athlete_nutrition_plan_versions') is not null
     or to_regclass('public.athlete_nutrition_meals') is not null
     or to_regclass('public.athlete_nutrition_meal_items') is not null
     or to_regprocedure('private.genesis_nutrition_access_scope(uuid)') is not null
     or to_regprocedure('private.genesis_guard_nutrition_plan()') is not null
     or to_regprocedure('private.genesis_guard_nutrition_version()') is not null
     or to_regprocedure('private.genesis_guard_nutrition_meal_content()') is not null then
    raise exception 'GENESIS_A21B2R1_SCHEMA_ROLLBACK_FAILED';
  end if;
  if pg_temp.genesis_a21_snapshot() is distinct from
      (select snapshot from genesis_a21_baseline) then
    raise exception 'GENESIS_A21B2R1_LEGACY_DATA_CHANGED';
  end if;
  raise notice 'PASS complete schema rollback and unchanged legacy records';
end;
$rollback_check$;

select 'GENESIS_A21B2R1_TRANSACTIONAL_TEST_PASS' as checkpoint;
