-- GENESIS OS — 002B6.C.3.B.1
-- Service-only bridge for privileged athlete onboarding and badge operations.
--
-- The currently published browser continues to call the legacy RPCs during the
-- transition. The new Edge Function will call only these service-role RPCs and
-- will derive actor identifiers from verified JWT claims.

do $preconditions$
declare
  v_function record;
  v_oid oid;
begin
  for v_function in
    select *
    from (
      values
        (
          'public.resolve_coach_invite(text)',
          'resolve_coach_invite'
        ),
        (
          'public.complete_athlete_onboarding(text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean)',
          'complete_athlete_onboarding'
        ),
        (
          'public.evaluate_athlete_badges(uuid)',
          'evaluate_athlete_badges'
        )
    ) as functions(signature, function_name)
  loop
    v_oid := to_regprocedure(v_function.signature);

    if v_oid is null then
      raise exception
        'GENESIS_C3B1_LEGACY_FUNCTION_MISSING: %',
        v_function.function_name;
    end if;

    if not (
      select function_definition.prosecdef
      from pg_catalog.pg_proc as function_definition
      where function_definition.oid = v_oid
    ) then
      raise exception
        'GENESIS_C3B1_LEGACY_FUNCTION_NOT_DEFINER: %',
        v_function.function_name;
    end if;

    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception
        'GENESIS_C3B1_LEGACY_BROWSER_ACCESS_MISSING: %',
        v_function.function_name;
    end if;
  end loop;
end;
$preconditions$;

create or replace function private.genesis_actor_session_is_valid(
  p_actor_user_id uuid,
  p_actor_session_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    p_actor_user_id is not null
    and p_actor_session_id is not null
    and exists (
      select 1
      from auth.sessions as session_row
      where session_row.id = p_actor_session_id
        and session_row.user_id = p_actor_user_id
        and (
          session_row.not_after is null
          or session_row.not_after > now()
        )
    );
$function$;

revoke all
  on function private.genesis_actor_session_is_valid(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on function private.genesis_actor_session_is_valid(uuid, uuid) is
  'Owner-internal validation for a verified Edge actor and live Supabase Auth session.';

create or replace function public.genesis_athlete_resolve_coach_invite(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_coach_id uuid;
  v_coach_user_id uuid;
  v_coach_name text;
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
    invitation.coach_id,
    invitation.coach_user_id,
    invitation.coach_name,
    invitation.athlete_plan
  into
    v_coach_id,
    v_coach_user_id,
    v_coach_name,
    v_athlete_plan
  from public.resolve_coach_invite(p_code) as invitation
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVITE_NOT_FOUND'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'coach_id', v_coach_id,
    'coach_user_id', v_coach_user_id,
    'coach_name', v_coach_name,
    'athlete_plan', v_athlete_plan
  );
end;
$function$;

revoke all
  on function public.genesis_athlete_resolve_coach_invite(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_resolve_coach_invite(uuid, uuid, text)
  to service_role;

comment on function public.genesis_athlete_resolve_coach_invite(uuid, uuid, text) is
  'Service-only invite resolution for the authenticated athlete Edge boundary.';

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
      'GENESIS_C3B1_COMPLETE_ONBOARDING_RESPONSE_MISSING';
  end if;

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
    uuid,
    uuid,
    text,
    text,
    integer,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text,
    text,
    boolean
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_complete_onboarding(
    uuid,
    uuid,
    text,
    text,
    integer,
    numeric,
    numeric,
    text,
    text,
    text,
    text,
    text,
    text,
    boolean
  )
  to service_role;

comment on function public.genesis_athlete_complete_onboarding(
  uuid,
  uuid,
  text,
  text,
  integer,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
) is
  'Service-only atomic onboarding execution for the authenticated athlete Edge boundary.';

create or replace function public.genesis_athlete_evaluate_badges(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_athlete_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_new_badges integer;
  v_total_badges bigint;
  v_fenix_12w boolean;
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
      and actor.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_FORBIDDEN'
    );
  end if;

  if p_athlete_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_ATHLETE_ID'
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
    evaluation.new_badges,
    evaluation.total_badges,
    evaluation.fenix_12w
  into
    v_new_badges,
    v_total_badges,
    v_fenix_12w
  from public.evaluate_athlete_badges(p_athlete_id) as evaluation
  limit 1;

  if not found then
    raise exception
      'GENESIS_C3B1_BADGE_EVALUATION_RESPONSE_MISSING';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'new_badges', v_new_badges,
    'total_badges', v_total_badges,
    'fenix_12w', v_fenix_12w
  );
end;
$function$;

revoke all
  on function public.genesis_athlete_evaluate_badges(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_evaluate_badges(uuid, uuid, uuid)
  to service_role;

comment on function public.genesis_athlete_evaluate_badges(uuid, uuid, uuid) is
  'Service-only badge evaluation for the authenticated athlete Edge boundary.';

do $postconditions$
declare
  v_function record;
  v_oid oid;
  v_public_execute boolean;
begin
  for v_function in
    select *
    from (
      values
        (
          'public.genesis_athlete_resolve_coach_invite(uuid,uuid,text)',
          'genesis_athlete_resolve_coach_invite'
        ),
        (
          'public.genesis_athlete_complete_onboarding(uuid,uuid,text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean)',
          'genesis_athlete_complete_onboarding'
        ),
        (
          'public.genesis_athlete_evaluate_badges(uuid,uuid,uuid)',
          'genesis_athlete_evaluate_badges'
        )
    ) as functions(signature, function_name)
  loop
    v_oid := to_regprocedure(v_function.signature);

    if v_oid is null then
      raise exception
        'GENESIS_C3B1_SERVICE_FUNCTION_MISSING: %',
        v_function.function_name;
    end if;

    if not (
      select
        function_definition.prosecdef
        and coalesce(
          function_definition.proconfig @> array['search_path=""']::text[],
          false
        )
      from pg_catalog.pg_proc as function_definition
      where function_definition.oid = v_oid
    ) then
      raise exception
        'GENESIS_C3B1_SERVICE_FUNCTION_HARDENING_MISMATCH: %',
        v_function.function_name;
    end if;

    if has_function_privilege('anon', v_oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_oid, 'EXECUTE')
       or not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception
        'GENESIS_C3B1_SERVICE_FUNCTION_GRANTS_MISMATCH: %',
        v_function.function_name;
    end if;

    select exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          function_definition.proacl,
          pg_catalog.acldefault('f', function_definition.proowner)
        )
      ) as privilege_row
      where privilege_row.grantee = 0
        and privilege_row.privilege_type = 'EXECUTE'
    )
    into v_public_execute
    from pg_catalog.pg_proc as function_definition
    where function_definition.oid = v_oid;

    if v_public_execute then
      raise exception
        'GENESIS_C3B1_SERVICE_FUNCTION_PUBLIC_EXECUTE_REMAINS: %',
        v_function.function_name;
    end if;
  end loop;

  v_oid := to_regprocedure(
    'private.genesis_actor_session_is_valid(uuid,uuid)'
  );

  if v_oid is null
     or (
       select function_definition.prosecdef
       from pg_catalog.pg_proc as function_definition
       where function_definition.oid = v_oid
     )
     or has_function_privilege('anon', v_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_oid, 'EXECUTE')
     or has_function_privilege('service_role', v_oid, 'EXECUTE') then
    raise exception
      'GENESIS_C3B1_SESSION_HELPER_HARDENING_MISMATCH';
  end if;
end;
$postconditions$;
