-- GENESIS OS — C3B14.2A
-- Secure, minimal in-app notifications for active Super Admin accounts.
-- No clinical, biometric, legal, or evidence details are stored in these alerts.

do $preconditions$
begin
  if to_regclass('public.system_notifications') is null then
    raise exception 'GENESIS_NOTIFICATION_TABLE_MISSING';
  end if;

  if to_regclass('public.admin_requests') is null then
    raise exception 'GENESIS_ADMIN_REQUESTS_TABLE_MISSING';
  end if;

  if to_regprocedure(
    'public.genesis_athlete_complete_onboarding(uuid,uuid,text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean)'
  ) is null then
    raise exception 'GENESIS_SECURE_ONBOARDING_FUNCTION_MISSING';
  end if;
end;
$preconditions$;

create or replace function private.genesis_notify_active_super_admins(
  p_title text,
  p_message text,
  p_type text
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
    type
  )
  select
    'SUPER_ADMIN',
    user_row.id,
    p_title,
    p_message,
    p_type
  from public.users_master as user_row
  where user_row.role::text = 'SUPER_ADMIN'
    and user_row.account_status::text = 'ACTIVE';
end;
$function$;

revoke all
  on function private.genesis_notify_active_super_admins(text, text, text)
  from public, anon, authenticated, service_role;

comment on function private.genesis_notify_active_super_admins(text, text, text) is
  'Owner-internal fan-out of minimal operational alerts to active Super Admin users.';

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
    'ADMIN_REQUEST'
  );

  return new;
end;
$function$;

revoke all
  on function private.genesis_notify_super_admin_on_admin_request()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_genesis_notify_super_admin_on_admin_request
  on public.admin_requests;

create trigger trg_genesis_notify_super_admin_on_admin_request
after insert on public.admin_requests
for each row
execute function private.genesis_notify_super_admin_on_admin_request();

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
    'NEW_ATHLETE'
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
  'Service-only onboarding execution with minimal Super Admin operational alert fan-out.';

do $postconditions$
declare
  v_onboarding_oid oid;
begin
  v_onboarding_oid := to_regprocedure(
    'public.genesis_athlete_complete_onboarding(uuid,uuid,text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean)'
  );

  if v_onboarding_oid is null
     or not (
       select procedure_row.prosecdef
       from pg_catalog.pg_proc as procedure_row
       where procedure_row.oid = v_onboarding_oid
     )
     or has_function_privilege('anon', v_onboarding_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_onboarding_oid, 'EXECUTE')
     or not has_function_privilege('service_role', v_onboarding_oid, 'EXECUTE') then
    raise exception 'GENESIS_SECURE_ONBOARDING_GRANTS_MISMATCH';
  end if;

  if to_regprocedure(
    'private.genesis_notify_active_super_admins(text,text,text)'
  ) is null then
    raise exception 'GENESIS_ADMIN_NOTIFICATION_HELPER_MISSING';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.admin_requests'::regclass
      and trigger_row.tgname =
        'trg_genesis_notify_super_admin_on_admin_request'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'GENESIS_ADMIN_REQUEST_NOTIFICATION_TRIGGER_MISSING';
  end if;
end;
$postconditions$;