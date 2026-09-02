-- GENESIS OS — 002B6.C.1
-- Canonical approval boundary for pending coaches.
--
-- The Edge Function derives actor identifiers from verified JWT claims.
-- This RPC is service-role only and does not mutate Auth directly.

create or replace function public.genesis_account_lifecycle_approve_coach(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_target_user_id uuid,
  p_ip_address text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_email text;
  v_actor_role text;
  v_actor_status text;
  v_target_role text;
  v_previous_status text;
  v_rows_updated bigint := 0;
begin
  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_target_user_id is null then
    return jsonb_build_object('allowed', false, 'code', 'INVALID_REQUEST');
  end if;

  if not exists (
    select 1
    from auth.sessions s
    where s.id = p_actor_session_id
      and s.user_id = p_actor_user_id
      and (s.not_after is null or s.not_after > now())
  ) then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_SESSION_INVALID');
  end if;

  select actor.email::text, actor.role::text, actor.account_status::text
    into v_actor_email, v_actor_role, v_actor_status
  from public.users_master actor
  where actor.id = p_actor_user_id
  limit 1;

  if v_actor_role <> 'SUPER_ADMIN' or v_actor_status <> 'ACTIVE' then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_FORBIDDEN');
  end if;

  if p_actor_user_id = p_target_user_id then
    return jsonb_build_object('allowed', false, 'code', 'SELF_ACTION_BLOCKED');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('genesis_account_lifecycle', 0)
  );

  select target.role::text, target.account_status::text
    into v_target_role, v_previous_status
  from public.users_master target
  where target.id = p_target_user_id
  for update;

  if v_target_role is null then
    return jsonb_build_object('allowed', false, 'code', 'TARGET_NOT_FOUND');
  end if;

  if v_target_role <> 'COACH' or v_previous_status <> 'PENDING' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_TRANSITION',
      'target_role', v_target_role,
      'target_status', v_previous_status
    );
  end if;

  update public.users_master
  set account_status = 'ACTIVE'::public.account_status
  where id = p_target_user_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> 1 then
    raise exception 'GENESIS_C1_APPROVAL_FAIL: target status update mismatch';
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    role,
    event_type,
    details,
    ip_address
  )
  values (
    p_actor_user_id,
    v_actor_email,
    v_actor_role,
    'ACCOUNT_APPROVED',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_role', v_target_role,
      'previous_status', v_previous_status,
      'target_status', 'ACTIVE'
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  );

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'action', 'APPROVE',
    'target_role', v_target_role,
    'target_status', 'ACTIVE'
  );
end
$function$;

revoke all on function public.genesis_account_lifecycle_approve_coach(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

grant execute on function public.genesis_account_lifecycle_approve_coach(
  uuid, uuid, uuid, text
) to service_role;

comment on function public.genesis_account_lifecycle_approve_coach(
  uuid, uuid, uuid, text
) is
  'Service-only canonical pending-coach approval with session validation and audit evidence.';

do $assertions$
declare
  v_oid oid;
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'genesis_account_lifecycle_approve_coach'
    and pg_get_function_identity_arguments(p.oid) =
      'p_actor_user_id uuid, p_actor_session_id uuid, p_target_user_id uuid, p_ip_address text'
    and p.prorettype = 'jsonb'::regtype
    and p.prosecdef
    and p.provolatile = 'v'
    and 'search_path=""' = any(p.proconfig);

  if v_oid is null then
    raise exception 'GENESIS_C1_FAIL: approval RPC hardening mismatch';
  end if;

  if has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_approve_coach(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_approve_coach(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_approve_coach(uuid,uuid,uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'GENESIS_C1_FAIL: approval RPC grants mismatch';
  end if;
end
$assertions$;
