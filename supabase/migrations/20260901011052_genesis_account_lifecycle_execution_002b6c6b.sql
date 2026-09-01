-- GENESIS OS — 002B6.C.6.B
-- Transactional execution helpers for privileged account lifecycle actions.
--
-- Both RPCs are service-role only. The Edge Function must derive actor IDs
-- exclusively from verified JWT claims and must call the existing preflight.

-- -----------------------------------------------------------------------------
-- 1. Atomic SUSPEND / REACTIVATE execution.
-- -----------------------------------------------------------------------------

create or replace function public.genesis_account_lifecycle_apply_status(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_ip_address text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_action text;
  v_preflight jsonb;
  v_actor_email text;
  v_actor_role text;
  v_target_role text;
  v_previous_status text;
  v_target_status text;
  v_sessions_revoked bigint := 0;
  v_rows_updated bigint := 0;
begin
  v_action := upper(btrim(coalesce(p_action, '')));

  if v_action not in ('SUSPEND', 'REACTIVATE') then
    return jsonb_build_object(
      'allowed', false,
      'code', 'INVALID_ACTION'
    );
  end if;

  -- Serializes lifecycle mutations, including the last-active-SuperAdmin guard.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('genesis_account_lifecycle', 0)
  );

  v_preflight := public.genesis_account_lifecycle_preflight(
    p_actor_user_id,
    p_actor_session_id,
    p_target_user_id,
    v_action
  );

  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    return v_preflight;
  end if;

  select actor.email::text, actor.role::text
    into v_actor_email, v_actor_role
  from public.users_master actor
  where actor.id = p_actor_user_id
  limit 1;

  select target.role::text, target.account_status::text
    into v_target_role, v_previous_status
  from public.users_master target
  where target.id = p_target_user_id
  for update;

  if v_target_role is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'TARGET_NOT_FOUND'
    );
  end if;

  v_target_status := case
    when v_action = 'SUSPEND' then 'SUSPENDED'
    else 'ACTIVE'
  end;

  update public.users_master
  set account_status = v_target_status::public.account_status
  where id = p_target_user_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> 1 then
    raise exception 'GENESIS_C6B_EXECUTION_FAIL: target status update mismatch';
  end if;

  if v_action = 'SUSPEND' then
    delete from auth.sessions
    where user_id = p_target_user_id;

    get diagnostics v_sessions_revoked = row_count;
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
    case
      when v_action = 'SUSPEND' then 'ACCOUNT_SUSPENDED'
      else 'ACCOUNT_REACTIVATED'
    end,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_role', v_target_role,
      'previous_status', v_previous_status,
      'target_status', v_target_status,
      'sessions_revoked', v_sessions_revoked
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  );

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'action', v_action,
    'target_role', v_target_role,
    'target_status', v_target_status,
    'sessions_revoked', v_sessions_revoked
  );
end
$function$;

revoke all on function public.genesis_account_lifecycle_apply_status(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.genesis_account_lifecycle_apply_status(
  uuid, uuid, uuid, text, text
) to service_role;

comment on function public.genesis_account_lifecycle_apply_status(
  uuid, uuid, uuid, text, text
) is
  'Service-only atomic suspend/reactivate executor with session revocation and audit evidence.';

-- -----------------------------------------------------------------------------
-- 2. Fail-closed HARD_DELETE preparation.
-- -----------------------------------------------------------------------------

create or replace function public.genesis_account_lifecycle_begin_hard_delete(
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
  v_preflight jsonb;
  v_actor_email text;
  v_actor_role text;
  v_target_role text;
  v_previous_status text;
  v_sessions_revoked bigint := 0;
  v_rows_updated bigint := 0;
  v_storage_objects jsonb := '[]'::jsonb;
  v_storage_object_count bigint := 0;
begin
  -- Uses the same lock as status mutations to close last-admin races.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('genesis_account_lifecycle', 0)
  );

  v_preflight := public.genesis_account_lifecycle_preflight(
    p_actor_user_id,
    p_actor_session_id,
    p_target_user_id,
    'HARD_DELETE'
  );

  if coalesce((v_preflight ->> 'allowed')::boolean, false) is not true then
    return v_preflight;
  end if;

  select actor.email::text, actor.role::text
    into v_actor_email, v_actor_role
  from public.users_master actor
  where actor.id = p_actor_user_id
  limit 1;

  select target.role::text, target.account_status::text
    into v_target_role, v_previous_status
  from public.users_master target
  where target.id = p_target_user_id
  for update;

  if v_target_role is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'TARGET_NOT_FOUND'
    );
  end if;

  -- Suspend before external cleanup so the target cannot create new data.
  update public.users_master
  set account_status = 'SUSPENDED'::public.account_status
  where id = p_target_user_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> 1 then
    raise exception 'GENESIS_C6B_EXECUTION_FAIL: hard-delete suspension mismatch';
  end if;

  delete from auth.sessions
  where user_id = p_target_user_id;

  get diagnostics v_sessions_revoked = row_count;

  select
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', so.bucket_id,
          'name', so.name
        )
        order by so.bucket_id, so.name
      ),
      '[]'::jsonb
    )
    into v_storage_object_count, v_storage_objects
  from storage.objects so
  where so.owner = p_target_user_id
     or so.owner_id = p_target_user_id::text;

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
    'ACCOUNT_HARD_DELETE_STARTED',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_role', v_target_role,
      'previous_status', v_previous_status,
      'target_status', 'SUSPENDED',
      'sessions_revoked', v_sessions_revoked,
      'storage_object_count', v_storage_object_count
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  );

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'action', 'HARD_DELETE',
    'target_role', v_target_role,
    'target_status', 'SUSPENDED',
    'sessions_revoked', v_sessions_revoked,
    'storage_object_count', v_storage_object_count,
    'storage_objects', v_storage_objects
  );
end
$function$;

revoke all on function public.genesis_account_lifecycle_begin_hard_delete(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

grant execute on function public.genesis_account_lifecycle_begin_hard_delete(
  uuid, uuid, uuid, text
) to service_role;

comment on function public.genesis_account_lifecycle_begin_hard_delete(
  uuid, uuid, uuid, text
) is
  'Service-only hard-delete preparation: revalidates authority, suspends, revokes sessions, audits, and returns Storage inventory.';

-- -----------------------------------------------------------------------------
-- 3. Fail-closed structural assertions.
-- -----------------------------------------------------------------------------

do $assertions$
declare
  v_apply_oid oid;
  v_begin_oid oid;
begin
  select p.oid
    into v_apply_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'genesis_account_lifecycle_apply_status'
    and pg_get_function_identity_arguments(p.oid) =
      'p_actor_user_id uuid, p_actor_session_id uuid, p_target_user_id uuid, p_action text, p_ip_address text'
    and p.prorettype = 'jsonb'::regtype
    and p.prosecdef
    and p.provolatile = 'v'
    and 'search_path=""' = any(p.proconfig);

  select p.oid
    into v_begin_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'genesis_account_lifecycle_begin_hard_delete'
    and pg_get_function_identity_arguments(p.oid) =
      'p_actor_user_id uuid, p_actor_session_id uuid, p_target_user_id uuid, p_ip_address text'
    and p.prorettype = 'jsonb'::regtype
    and p.prosecdef
    and p.provolatile = 'v'
    and 'search_path=""' = any(p.proconfig);

  if v_apply_oid is null or v_begin_oid is null then
    raise exception 'GENESIS_C6B_FAIL: lifecycle executor hardening mismatch';
  end if;

  if exists (
       select 1
       from aclexplode(coalesce(
         (select p.proacl from pg_proc p where p.oid = v_apply_oid),
         acldefault('f', (select p.proowner from pg_proc p where p.oid = v_apply_oid))
       )) acl
       where acl.grantee = 0
         and acl.privilege_type = 'EXECUTE'
     )
     or exists (
       select 1
       from aclexplode(coalesce(
         (select p.proacl from pg_proc p where p.oid = v_begin_oid),
         acldefault('f', (select p.proowner from pg_proc p where p.oid = v_begin_oid))
       )) acl
       where acl.grantee = 0
         and acl.privilege_type = 'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_apply_status(uuid,uuid,uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_apply_status(uuid,uuid,uuid,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_apply_status(uuid,uuid,uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_begin_hard_delete(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_begin_hard_delete(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_begin_hard_delete(uuid,uuid,uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'GENESIS_C6B_FAIL: lifecycle executor grants mismatch';
  end if;

  if not has_table_privilege('service_role', 'public.audit_logs', 'INSERT') then
    raise exception 'GENESIS_C6B_FAIL: audit insert compatibility missing';
  end if;
end
$assertions$;
