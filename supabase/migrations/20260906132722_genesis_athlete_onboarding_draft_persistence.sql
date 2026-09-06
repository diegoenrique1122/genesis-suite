begin;

-- A private, resumable onboarding draft for authenticated athletes.
-- The browser never receives direct table privileges: all access goes through
-- the authenticated Genesis Edge boundary and service-only RPC wrappers.
create table public.athlete_onboarding_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step smallint not null default 1
    check (step between 1 and 4),
  coach_code text,
  full_name text,
  age integer,
  weight numeric,
  height numeric,
  gender text,
  goal text,
  injuries text,
  legal_accepted boolean not null default false,
  front_path text,
  side_path text,
  back_path text,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  check (coach_code is null or char_length(coach_code) between 1 and 128),
  check (full_name is null or char_length(full_name) between 1 and 200),
  check (age is null or age between 14 and 99),
  check (weight is null or weight between 1 and 1000),
  check (height is null or height between 1 and 300),
  check (gender is null or char_length(gender) between 1 and 64),
  check (goal is null or char_length(goal) between 1 and 2000),
  check (injuries is null or char_length(injuries) between 1 and 4000),
  check (front_path is null or char_length(front_path) between 1 and 1024),
  check (side_path is null or char_length(side_path) between 1 and 1024),
  check (back_path is null or char_length(back_path) between 1 and 1024)
);

alter table public.athlete_onboarding_drafts enable row level security;

revoke all
  on table public.athlete_onboarding_drafts
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.athlete_onboarding_drafts
  to service_role;

comment on table public.athlete_onboarding_drafts is
  'Service-only resumable athlete onboarding drafts. No browser Data API access.';

create or replace function public.genesis_athlete_get_onboarding_draft(
  p_actor_user_id uuid,
  p_actor_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_draft jsonb;
begin
  if not private.genesis_actor_session_is_valid(
    p_actor_user_id,
    p_actor_session_id
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_SESSION_INVALID'
    );
  end if;

  if not exists (
    select 1
    from public.users_master as actor
    where actor.id = p_actor_user_id
      and actor.role::text = 'ATHLETE'
      and actor.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_FORBIDDEN'
    );
  end if;

  delete from public.athlete_onboarding_drafts
  where user_id = p_actor_user_id
    and expires_at <= now();

  select jsonb_build_object(
    'step', draft.step,
    'coach_code', draft.coach_code,
    'full_name', draft.full_name,
    'age', draft.age,
    'weight', draft.weight,
    'height', draft.height,
    'gender', draft.gender,
    'goal', draft.goal,
    'injuries', draft.injuries,
    'legal_accepted', draft.legal_accepted,
    'front_path', draft.front_path,
    'side_path', draft.side_path,
    'back_path', draft.back_path
  )
  into v_draft
  from public.athlete_onboarding_drafts as draft
  where draft.user_id = p_actor_user_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'draft', v_draft
  );
end;
$function$;

revoke all
  on function public.genesis_athlete_get_onboarding_draft(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_get_onboarding_draft(uuid, uuid)
  to service_role;

comment on function public.genesis_athlete_get_onboarding_draft(uuid, uuid) is
  'Service-only retrieval of the current athlete onboarding draft.';

create or replace function public.genesis_athlete_save_onboarding_draft(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_draft jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_athlete_id uuid;
  v_step smallint;
  v_coach_code text;
  v_full_name text;
  v_age integer;
  v_weight numeric;
  v_height numeric;
  v_gender text;
  v_goal text;
  v_injuries text;
  v_legal_accepted boolean;
  v_front_path text;
  v_side_path text;
  v_back_path text;
  v_previous_front_path text;
  v_previous_side_path text;
  v_previous_back_path text;
  v_prefix text;
  v_saved_draft jsonb;
  v_replaced_paths text[];
begin
  if not private.genesis_actor_session_is_valid(
    p_actor_user_id,
    p_actor_session_id
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_SESSION_INVALID'
    );
  end if;

  if not exists (
    select 1
    from public.users_master as actor
    where actor.id = p_actor_user_id
      and actor.role::text = 'ATHLETE'
      and actor.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_FORBIDDEN'
    );
  end if;

  if jsonb_typeof(p_draft) <> 'object' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_DRAFT_INPUT'
    );
  end if;

  begin
    v_step := (p_draft ->> 'step')::smallint;
    v_coach_code := nullif(p_draft ->> 'coach_code', '');
    v_full_name := nullif(p_draft ->> 'full_name', '');
    v_age := nullif(p_draft ->> 'age', '')::integer;
    v_weight := nullif(p_draft ->> 'weight', '')::numeric;
    v_height := nullif(p_draft ->> 'height', '')::numeric;
    v_gender := nullif(p_draft ->> 'gender', '');
    v_goal := nullif(p_draft ->> 'goal', '');
    v_injuries := nullif(p_draft ->> 'injuries', '');
    v_legal_accepted := coalesce(
      (p_draft ->> 'legal_accepted')::boolean,
      false
    );
    v_front_path := nullif(p_draft ->> 'front_path', '');
    v_side_path := nullif(p_draft ->> 'side_path', '');
    v_back_path := nullif(p_draft ->> 'back_path', '');
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      return jsonb_build_object(
        'allowed', false,
        'code', 'INVALID_DRAFT_INPUT'
      );
  end;

  if v_step is null
     or v_step not between 1 and 4 then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_DRAFT_INPUT'
    );
  end if;

  select profile.id
  into v_athlete_id
  from public.athletes_profile as profile
  where profile.user_id = p_actor_user_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ATHLETE_PROFILE_NOT_FOUND'
    );
  end if;

  v_prefix := v_athlete_id::text || '/week_0/front/';

  if v_front_path is not null
     and (
       left(v_front_path, char_length(v_prefix)) <> v_prefix
       or position('..' in v_front_path) > 0
     ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DRAFT_FRONT_PHOTO_PATH_INVALID'
    );
  end if;

  v_prefix := v_athlete_id::text || '/week_0/side/';

  if v_side_path is not null
     and (
       left(v_side_path, char_length(v_prefix)) <> v_prefix
       or position('..' in v_side_path) > 0
     ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DRAFT_SIDE_PHOTO_PATH_INVALID'
    );
  end if;

  v_prefix := v_athlete_id::text || '/week_0/back/';

  if v_back_path is not null
     and (
       left(v_back_path, char_length(v_prefix)) <> v_prefix
       or position('..' in v_back_path) > 0
     ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DRAFT_BACK_PHOTO_PATH_INVALID'
    );
  end if;

  select
    draft.front_path,
    draft.side_path,
    draft.back_path
  into
    v_previous_front_path,
    v_previous_side_path,
    v_previous_back_path
  from public.athlete_onboarding_drafts as draft
  where draft.user_id = p_actor_user_id
  for update;

  insert into public.athlete_onboarding_drafts (
    user_id,
    step,
    coach_code,
    full_name,
    age,
    weight,
    height,
    gender,
    goal,
    injuries,
    legal_accepted,
    front_path,
    side_path,
    back_path,
    updated_at,
    expires_at
  )
  values (
    p_actor_user_id,
    v_step,
    v_coach_code,
    v_full_name,
    v_age,
    v_weight,
    v_height,
    v_gender,
    v_goal,
    v_injuries,
    v_legal_accepted,
    v_front_path,
    v_side_path,
    v_back_path,
    now(),
    now() + interval '30 days'
  )
  on conflict (user_id) do update
  set
    step = excluded.step,
    coach_code = excluded.coach_code,
    full_name = excluded.full_name,
    age = excluded.age,
    weight = excluded.weight,
    height = excluded.height,
    gender = excluded.gender,
    goal = excluded.goal,
    injuries = excluded.injuries,
    legal_accepted = excluded.legal_accepted,
    front_path = excluded.front_path,
    side_path = excluded.side_path,
    back_path = excluded.back_path,
    updated_at = excluded.updated_at,
    expires_at = excluded.expires_at;

  select jsonb_build_object(
    'step', draft.step,
    'coach_code', draft.coach_code,
    'full_name', draft.full_name,
    'age', draft.age,
    'weight', draft.weight,
    'height', draft.height,
    'gender', draft.gender,
    'goal', draft.goal,
    'injuries', draft.injuries,
    'legal_accepted', draft.legal_accepted,
    'front_path', draft.front_path,
    'side_path', draft.side_path,
    'back_path', draft.back_path
  )
  into v_saved_draft
  from public.athlete_onboarding_drafts as draft
  where draft.user_id = p_actor_user_id;

  v_replaced_paths := array_remove(
    array[
      case
        when v_front_path is not null
          and v_front_path is distinct from v_previous_front_path
          then v_previous_front_path
        else null
      end,
      case
        when v_side_path is not null
          and v_side_path is distinct from v_previous_side_path
          then v_previous_side_path
        else null
      end,
      case
        when v_back_path is not null
          and v_back_path is distinct from v_previous_back_path
          then v_previous_back_path
        else null
      end
    ]::text[],
    null
  );

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'draft', v_saved_draft,
    'replaced_paths', to_jsonb(v_replaced_paths)
  );
end;
$function$;

revoke all
  on function public.genesis_athlete_save_onboarding_draft(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_save_onboarding_draft(uuid, uuid, jsonb)
  to service_role;

comment on function public.genesis_athlete_save_onboarding_draft(uuid, uuid, jsonb) is
  'Service-only persistence for an authenticated athlete onboarding draft.';

create or replace function public.genesis_athlete_complete_onboarding(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_code text,
  p_full_name text,
  p_age integer,
  p_weight numeric,
  p_height numeric,
  p_gender text,
  p_goal text,
  p_injuries text,
  p_front_url text,
  p_side_url text,
  p_back_url text,
  p_legal_accepted boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_athlete_id uuid;
  v_coach_id uuid;
  v_coach_user_id uuid;
  v_athlete_plan text;
begin
  if not private.genesis_actor_session_is_valid(
    p_actor_user_id,
    p_actor_session_id
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_SESSION_INVALID'
    );
  end if;

  if not exists (
    select 1
    from public.users_master as actor
    where actor.id = p_actor_user_id
      and actor.role::text = 'ATHLETE'
      and actor.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_FORBIDDEN'
    );
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    p_actor_user_id::text,
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_actor_user_id,
      'role', 'authenticated',
      'session_id', p_actor_session_id
    )::text,
    true
  );

  select
    onboarding.athlete_id,
    onboarding.coach_id,
    onboarding.coach_user_id,
    onboarding.athlete_plan
  into
    v_athlete_id,
    v_coach_id,
    v_coach_user_id,
    v_athlete_plan
  from public.complete_athlete_onboarding(
    p_code,
    p_full_name,
    p_age,
    p_weight,
    p_height,
    p_gender,
    p_goal,
    p_injuries,
    p_front_url,
    p_side_url,
    p_back_url,
    p_legal_accepted
  ) as onboarding
  limit 1;

  if not found then
    raise exception
      'GENESIS_C3B13_COMPLETE_ONBOARDING_RESPONSE_MISSING';
  end if;

  delete from public.athlete_onboarding_drafts
  where user_id = p_actor_user_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'athlete_id', v_athlete_id,
    'coach_id', v_coach_id,
    'coach_user_id', v_coach_user_id,
    'athlete_plan', v_athlete_plan
  );
end;
$function$;

revoke all
  on function public.genesis_athlete_complete_onboarding(
    uuid, uuid, text, text, integer, numeric, numeric, text, text, text,
    text, text, text, boolean
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_complete_onboarding(
    uuid, uuid, text, text, integer, numeric, numeric, text, text, text,
    text, text, text, boolean
  )
  to service_role;

do $postconditions$
declare
  v_get_oid oid := to_regprocedure(
    'public.genesis_athlete_get_onboarding_draft(uuid,uuid)'
  );
  v_save_oid oid := to_regprocedure(
    'public.genesis_athlete_save_onboarding_draft(uuid,uuid,jsonb)'
  );
begin
  if v_get_oid is null
     or v_save_oid is null
     or not (
       select c.relrowsecurity
       from pg_catalog.pg_class as c
       where c.oid = 'public.athlete_onboarding_drafts'::regclass
     )
     or has_table_privilege(
       'anon',
       'public.athlete_onboarding_drafts',
       'select,insert,update,delete'
     )
     or has_table_privilege(
       'authenticated',
       'public.athlete_onboarding_drafts',
       'select,insert,update,delete'
     )
     or not has_table_privilege(
       'service_role',
       'public.athlete_onboarding_drafts',
       'select,insert,update,delete'
     )
     or has_function_privilege('anon', v_get_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_get_oid, 'EXECUTE')
     or not has_function_privilege('service_role', v_get_oid, 'EXECUTE')
     or has_function_privilege('anon', v_save_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_save_oid, 'EXECUTE')
     or not has_function_privilege('service_role', v_save_oid, 'EXECUTE') then
    raise exception
      'GENESIS_C3B13_DRAFT_SECURITY_POSTCONDITION_FAILED';
  end if;
end;
$postconditions$;

commit;
