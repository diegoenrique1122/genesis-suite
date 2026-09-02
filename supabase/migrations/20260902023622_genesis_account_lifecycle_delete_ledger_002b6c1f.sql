-- 002B6.C.1.F: durable, service-only hard-delete operation ledger.
-- A PREPARED row is committed before external Auth deletion. Completion is
-- recorded atomically with the final audit event, enabling reconciliation.

create table public.account_lifecycle_operations (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action = 'HARD_DELETE'),
  status text not null default 'PREPARED'
    check (status in ('PREPARED', 'COMPLETED')),
  actor_user_id uuid not null,
  actor_email text,
  actor_role text not null,
  target_user_id uuid not null,
  target_role text not null,
  previous_status text,
  sessions_revoked bigint not null default 0
    check (sessions_revoked >= 0),
  storage_object_count bigint not null default 0
    check (storage_object_count >= 0),
  storage_objects jsonb not null default '[]'::jsonb
    check (jsonb_typeof(storage_objects) = 'array'),
  started_at timestamptz not null default now(),
  started_audit_id uuid,
  completed_at timestamptz,
  completion_audit_id uuid,
  check (
    (status = 'PREPARED' and completed_at is null and completion_audit_id is null)
    or
    (status = 'COMPLETED' and completed_at is not null and completion_audit_id is not null)
  )
);

create index account_lifecycle_operations_prepared_idx
  on public.account_lifecycle_operations (started_at)
  where status = 'PREPARED';

alter table public.account_lifecycle_operations enable row level security;

revoke all on table public.account_lifecycle_operations
  from public, anon, authenticated;
grant select, insert, update on table public.account_lifecycle_operations
  to service_role;

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
  v_operation_id uuid;
  v_started_audit_id uuid;
begin
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
    return jsonb_build_object('allowed', false, 'code', 'TARGET_NOT_FOUND');
  end if;

  update public.users_master
  set account_status = 'SUSPENDED'::public.account_status
  where id = p_target_user_id;

  get diagnostics v_rows_updated = row_count;
  if v_rows_updated <> 1 then
    raise exception 'GENESIS_C1F_EXECUTION_FAIL: hard-delete suspension mismatch';
  end if;

  delete from auth.sessions
  where user_id = p_target_user_id;

  get diagnostics v_sessions_revoked = row_count;

  select
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object('bucket_id', so.bucket_id, 'name', so.name)
        order by so.bucket_id, so.name
      ),
      '[]'::jsonb
    )
    into v_storage_object_count, v_storage_objects
  from storage.objects so
  where so.owner = p_target_user_id
     or so.owner_id = p_target_user_id::text;

  insert into public.account_lifecycle_operations (
    action,
    status,
    actor_user_id,
    actor_email,
    actor_role,
    target_user_id,
    target_role,
    previous_status,
    sessions_revoked,
    storage_object_count,
    storage_objects
  )
  values (
    'HARD_DELETE',
    'PREPARED',
    p_actor_user_id,
    v_actor_email,
    v_actor_role,
    p_target_user_id,
    v_target_role,
    v_previous_status,
    v_sessions_revoked,
    v_storage_object_count,
    v_storage_objects
  )
  returning id into v_operation_id;

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
      'operation_id', v_operation_id,
      'target_user_id', p_target_user_id,
      'target_role', v_target_role,
      'previous_status', v_previous_status,
      'target_status', 'SUSPENDED',
      'sessions_revoked', v_sessions_revoked,
      'storage_object_count', v_storage_object_count
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  )
  returning id into v_started_audit_id;

  update public.account_lifecycle_operations
  set started_audit_id = v_started_audit_id
  where id = v_operation_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'action', 'HARD_DELETE',
    'operation_id', v_operation_id,
    'target_role', v_target_role,
    'target_status', 'SUSPENDED',
    'sessions_revoked', v_sessions_revoked,
    'storage_object_count', v_storage_object_count,
    'storage_objects', v_storage_objects
  );
end
$function$;

create or replace function public.genesis_account_lifecycle_finalize_hard_delete(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_operation_id uuid,
  p_ip_address text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_operation public.account_lifecycle_operations%rowtype;
  v_completion_audit_id uuid;
begin
  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_operation_id is null then
    return jsonb_build_object('allowed', false, 'code', 'INVALID_REQUEST');
  end if;

  if not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = p_actor_session_id
      and session_row.user_id = p_actor_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  ) then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_SESSION_INVALID');
  end if;

  if not exists (
    select 1
    from public.users_master actor
    where actor.id = p_actor_user_id
      and actor.role::text = 'SUPER_ADMIN'
      and actor.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_FORBIDDEN');
  end if;

  select *
    into v_operation
  from public.account_lifecycle_operations operation_row
  where operation_row.id = p_operation_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'code', 'OPERATION_NOT_FOUND');
  end if;

  if v_operation.action <> 'HARD_DELETE'
     or v_operation.actor_user_id <> p_actor_user_id then
    return jsonb_build_object('allowed', false, 'code', 'OPERATION_FORBIDDEN');
  end if;

  if v_operation.status = 'COMPLETED' then
    return jsonb_build_object(
      'allowed', true,
      'code', 'ALREADY_COMPLETED',
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id
    );
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
    v_operation.actor_user_id,
    v_operation.actor_email,
    v_operation.actor_role,
    'ACCOUNT_HARD_DELETE_COMPLETED',
    jsonb_build_object(
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id,
      'target_role', v_operation.target_role,
      'previous_status', v_operation.previous_status,
      'sessions_revoked', v_operation.sessions_revoked,
      'storage_object_count', v_operation.storage_object_count,
      'storage_objects_deleted', v_operation.storage_object_count
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  )
  returning id into v_completion_audit_id;

  update public.account_lifecycle_operations
  set
    status = 'COMPLETED',
    completed_at = now(),
    completion_audit_id = v_completion_audit_id
  where id = v_operation.id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'operation_id', v_operation.id,
    'target_user_id', v_operation.target_user_id
  );
end
$function$;

revoke all on function public.genesis_account_lifecycle_begin_hard_delete(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.genesis_account_lifecycle_begin_hard_delete(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.genesis_account_lifecycle_finalize_hard_delete(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.genesis_account_lifecycle_finalize_hard_delete(uuid, uuid, uuid, text)
  to service_role;

do $assertions$
begin
  if not exists (
    select 1
    from pg_catalog.pg_class relation_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname = 'account_lifecycle_operations'
      and relation_row.relrowsecurity
  ) then
    raise exception 'GENESIS_C1F_ASSERTION_FAILED: ledger RLS is not enabled';
  end if;

  if has_table_privilege('anon', 'public.account_lifecycle_operations', 'select')
     or has_table_privilege('authenticated', 'public.account_lifecycle_operations', 'select') then
    raise exception 'GENESIS_C1F_ASSERTION_FAILED: browser role can read ledger';
  end if;

  if not has_table_privilege('service_role', 'public.account_lifecycle_operations', 'select,insert,update') then
    raise exception 'GENESIS_C1F_ASSERTION_FAILED: service role lacks ledger access';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname in (
        'genesis_account_lifecycle_begin_hard_delete',
        'genesis_account_lifecycle_finalize_hard_delete'
      )
      and (
        not function_row.prosecdef
        or coalesce(array_to_string(function_row.proconfig, ','), '') not like '%search_path=%'
      )
  ) then
    raise exception 'GENESIS_C1F_ASSERTION_FAILED: lifecycle function security settings invalid';
  end if;
end
$assertions$;
