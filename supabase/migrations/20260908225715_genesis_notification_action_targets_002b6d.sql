-- GENESIS OS - C3B14.2B
-- Action references for secure notification navigation.
-- Notification text remains minimal and contains no clinical, biometric,
-- legal, or private-evidence details.

do $preconditions$
begin
  if to_regclass('public.system_notifications') is null then
    raise exception 'GENESIS_NOTIFICATION_TABLE_MISSING';
  end if;

  if to_regclass('public.admin_requests') is null then
    raise exception 'GENESIS_ADMIN_REQUESTS_TABLE_MISSING';
  end if;

  if to_regprocedure(
    'private.genesis_notify_active_super_admins(text,text,text)'
  ) is null then
    raise exception 'GENESIS_ADMIN_NOTIFICATION_HELPER_MISSING';
  end if;

  if to_regprocedure(
    'public.genesis_athlete_complete_onboarding(uuid,uuid,text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean)'
  ) is null then
    raise exception 'GENESIS_SECURE_ONBOARDING_FUNCTION_MISSING';
  end if;
end;
$preconditions$;

alter table public.system_notifications
  add column if not exists resource_type text,
  add column if not exists resource_id uuid;

alter table public.system_notifications
  drop constraint if exists system_notifications_resource_target_check;

alter table public.system_notifications
  add constraint system_notifications_resource_target_check
  check (
    (resource_type is null and resource_id is null)
    or (
      resource_type in (
        'ADMIN_REQUEST',
        'ATHLETE',
        'ATHLETE_PROGRAM',
        'ROUTINE',
        'CHAT_MESSAGE'
      )
      and resource_id is not null
    )
  );

create index if not exists system_notifications_recipient_created_idx
  on public.system_notifications (recipient_id, created_at desc);

-- The original three-argument helper is preserved for compatibility.
-- This overload adds an opaque resource reference. The frontend decides
-- the allowed destination from resource_type plus the current authority.

create or replace function private.genesis_notify_active_super_admins(
  p_title text,
  p_message text,
  p_type text,
  p_resource_type text,
  p_resource_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.system_notifications (
    recipient_role,
    recipient_id,
    title,
    message,
    type,
    resource_type,
    resource_id
  )
  select
    'SUPER_ADMIN',
    user_row.id,
    p_title,
    p_message,
    p_type,
    p_resource_type,
    p_resource_id
  from public.users_master as user_row
  where user_row.role::text = 'SUPER_ADMIN'
    and user_row.account_status::text = 'ACTIVE';
end;
$function$;

revoke all
  on function private.genesis_notify_active_super_admins(
    text, text, text, text, uuid
  )
  from public, anon, authenticated, service_role;

create or replace function private.genesis_notify_super_admin_on_admin_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.genesis_notify_active_super_admins(
    'New coach request',
    'A coach submitted an administrative request. Review the management inbox.',
    'ADMIN_REQUEST',
    'ADMIN_REQUEST',
    new.id
  );

  return new;
end;
$function$;

revoke all
  on function private.genesis_notify_super_admin_on_admin_request()
  from public, anon, authenticated, service_role;

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

  perform private.genesis_notify_active_super_admins(
    'New athlete registered',
    'An athlete completed registration. Review the roster for authorized information.',
    'NEW_ATHLETE',
    'ATHLETE',
    v_athlete_id
  );

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
    uuid, uuid, text, text, integer, numeric, numeric, text, text,
    text, text, text, text, boolean
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.genesis_athlete_complete_onboarding(
    uuid, uuid, text, text, integer, numeric, numeric, text, text,
    text, text, text, text, boolean
  )
  to service_role;

do $postconditions$
declare
  v_target_constraint_exists boolean;
  v_target_index_exists boolean;
  v_helper_is_secure boolean;
  v_onboarding_is_secure boolean;
begin
  select exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.system_notifications'::regclass
      and constraint_row.conname =
        'system_notifications_resource_target_check'
  )
  into v_target_constraint_exists;

  select to_regclass(
    'public.system_notifications_recipient_created_idx'
  ) is not null
  into v_target_index_exists;

  select procedure_row.prosecdef
    and not has_function_privilege(
      'anon',
      procedure_row.oid,
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      procedure_row.oid,
      'EXECUTE'
    )
  from pg_catalog.pg_proc as procedure_row
  where procedure_row.oid = to_regprocedure(
    'private.genesis_notify_active_super_admins(text,text,text,text,uuid)'
  )
  into v_helper_is_secure;

  select procedure_row.prosecdef
    and not has_function_privilege(
      'anon',
      procedure_row.oid,
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      procedure_row.oid,
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      procedure_row.oid,
      'EXECUTE'
    )
  from pg_catalog.pg_proc as procedure_row
  where procedure_row.oid = to_regprocedure(
    'public.genesis_athlete_complete_onboarding(uuid,uuid,text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean)'
  )
  into v_onboarding_is_secure;

  if not v_target_constraint_exists
     or not v_target_index_exists
     or not coalesce(v_helper_is_secure, false)
     or not coalesce(v_onboarding_is_secure, false) then
    raise exception 'GENESIS_NOTIFICATION_ACTION_TARGETS_VERIFY_FAILED';
  end if;
end;
$postconditions$;