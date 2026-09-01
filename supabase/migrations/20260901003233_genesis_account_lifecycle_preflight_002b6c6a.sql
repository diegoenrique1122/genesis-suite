-- GENESIS OS — 002B6.C.6.3
-- Service-only session and dependency preflight for privileged account lifecycle.
--
-- The Edge Function must derive actor_user_id and actor_session_id exclusively
-- from verified JWT claims. Client-provided actor identifiers are never trusted.

create or replace function public.genesis_account_lifecycle_preflight(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_target_user_id uuid,
  p_action text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_action text;
  v_target_role text;
  v_target_status text;
  v_target_coach_id uuid;
  v_target_athlete_id uuid;
  v_active_super_admins bigint := 0;
  v_assigned_athletes bigint := 0;
  v_coach_referrals bigint := 0;
  v_announcements bigint := 0;
  v_chat_messages bigint := 0;
  v_storage_objects bigint := 0;
  v_athlete_photo_rows bigint := 0;
begin
  v_action := upper(btrim(coalesce(p_action, '')));

  if v_action not in ('SUSPEND', 'REACTIVATE', 'HARD_DELETE') then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_ACTION'
    );
  end if;

  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_target_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_REQUEST'
    );
  end if;

  -- Strong guarantee for privileged actions: the signed JWT must reference a
  -- session that still exists and belongs to the verified actor.
  if not exists (
    select 1
    from auth.sessions s
    where s.id = p_actor_session_id
      and s.user_id = p_actor_user_id
      and (s.not_after is null or s.not_after > now())
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_SESSION_INVALID'
    );
  end if;

  if not exists (
    select 1
    from public.users_master actor
    where actor.id = p_actor_user_id
      and actor.role::text = 'SUPER_ADMIN'
      and actor.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACTOR_FORBIDDEN'
    );
  end if;

  if p_actor_user_id = p_target_user_id then
    return jsonb_build_object(
      'allowed', false,
      'code', 'SELF_ACTION_BLOCKED'
    );
  end if;

  select target.role::text, target.account_status::text
    into v_target_role, v_target_status
  from public.users_master target
  where target.id = p_target_user_id
  limit 1;

  if v_target_role is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'TARGET_NOT_FOUND'
    );
  end if;

  if v_action = 'SUSPEND' and v_target_status <> 'ACTIVE' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_TRANSITION',
      'target_role', v_target_role,
      'target_status', v_target_status
    );
  end if;

  if v_action = 'REACTIVATE' and v_target_status <> 'SUSPENDED' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_TRANSITION',
      'target_role', v_target_role,
      'target_status', v_target_status
    );
  end if;

  select count(*)
    into v_active_super_admins
  from public.users_master um
  where um.role::text = 'SUPER_ADMIN'
    and um.account_status::text = 'ACTIVE';

  if v_target_role = 'SUPER_ADMIN'
     and v_target_status = 'ACTIVE'
     and v_action in ('SUSPEND', 'HARD_DELETE')
     and v_active_super_admins <= 1 then
    return jsonb_build_object(
      'allowed', false,
      'code', 'LAST_ACTIVE_SUPER_ADMIN',
      'target_role', v_target_role,
      'target_status', v_target_status
    );
  end if;

  select cp.id
    into v_target_coach_id
  from public.coaches_profile cp
  where cp.user_id = p_target_user_id
  limit 1;

  select ap.id
    into v_target_athlete_id
  from public.athletes_profile ap
  where ap.user_id = p_target_user_id
  limit 1;

  if v_target_coach_id is not null then
    select count(*)
      into v_assigned_athletes
    from public.athletes_profile ap
    where ap.coach_id = v_target_coach_id;

    select count(*)
      into v_coach_referrals
    from public.coaches_profile cp
    where cp.referred_by_coach_id = v_target_coach_id;
  end if;

  select count(*)
    into v_announcements
  from public.global_announcements ga
  where ga.created_by = p_target_user_id;

  select count(*)
    into v_chat_messages
  from public.chat_messages cm
  where cm.sender_id = p_target_user_id
     or cm.recipient_id = p_target_user_id;

  select count(*)
    into v_storage_objects
  from storage.objects so
  where so.owner = p_target_user_id
     or so.owner_id = p_target_user_id::text;

  if v_target_athlete_id is not null then
    select count(*)
      into v_athlete_photo_rows
    from public.athlete_photos aph
    where aph.athlete_id = v_target_athlete_id;
  end if;

  if v_action = 'HARD_DELETE'
     and (
       v_assigned_athletes > 0
       or v_coach_referrals > 0
       or v_announcements > 0
     ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DEPENDENCIES_EXIST',
      'target_role', v_target_role,
      'target_status', v_target_status,
      'blockers', jsonb_build_object(
        'assigned_athletes', v_assigned_athletes,
        'coach_referrals', v_coach_referrals,
        'global_announcements', v_announcements
      ),
      'cleanup', jsonb_build_object(
        'chat_messages', v_chat_messages,
        'storage_objects', v_storage_objects,
        'athlete_photo_rows', v_athlete_photo_rows
      )
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'action', v_action,
    'target_role', v_target_role,
    'target_status', v_target_status,
    'active_super_admins', v_active_super_admins,
    'blockers', jsonb_build_object(
      'assigned_athletes', v_assigned_athletes,
      'coach_referrals', v_coach_referrals,
      'global_announcements', v_announcements
    ),
    'cleanup', jsonb_build_object(
      'chat_messages', v_chat_messages,
      'storage_objects', v_storage_objects,
      'athlete_photo_rows', v_athlete_photo_rows
    )
  );
end
$function$;

-- SECURITY DEFINER is required to read auth.sessions and storage.objects, but
-- the RPC is callable only by the Edge Function's service-role client.
revoke all on function public.genesis_account_lifecycle_preflight(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

grant execute on function public.genesis_account_lifecycle_preflight(
  uuid, uuid, uuid, text
) to service_role;

comment on function public.genesis_account_lifecycle_preflight(
  uuid, uuid, uuid, text
) is
  'Service-only session and dependency guard for Genesis account lifecycle actions.';

-- Fail closed if the privileged RPC is not hardened exactly as designed.
do $assertions$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'genesis_account_lifecycle_preflight'
      and pg_get_function_identity_arguments(p.oid) =
        'p_actor_user_id uuid, p_actor_session_id uuid, p_target_user_id uuid, p_action text'
      and p.prorettype = 'jsonb'::regtype
      and p.prosecdef
      and p.provolatile = 's'
      and 'search_path=""' = any(p.proconfig)
  ) then
    raise exception 'GENESIS_C6A_FAIL: lifecycle preflight hardening mismatch';
  end if;

  if has_function_privilege(
       'public',
       'public.genesis_account_lifecycle_preflight(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_preflight(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_preflight(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_preflight(uuid,uuid,uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'GENESIS_C6A_FAIL: lifecycle preflight grants mismatch';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'auth'
      and tablename = 'sessions'
      and indexdef ilike '%(id)%'
  )
  or not exists (
    select 1
    from pg_indexes
    where schemaname = 'auth'
      and tablename = 'sessions'
      and indexdef ilike '%(user_id)%'
  ) then
    raise exception 'GENESIS_C6A_FAIL: required auth.sessions indexes missing';
  end if;
end
$assertions$;
