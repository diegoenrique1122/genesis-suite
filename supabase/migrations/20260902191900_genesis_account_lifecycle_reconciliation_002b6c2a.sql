-- 002B6.C.2.A: resumable hard-delete workflow.
-- The legacy C1F functions remain callable during the Edge deployment window.
-- C2 adds a leased state machine and service-only recovery RPCs.

alter table public.account_lifecycle_operations
  add column if not exists attempt_count bigint not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists recovery_required_at timestamptz,
  add column if not exists last_error_stage text,
  add column if not exists last_error_code text,
  add column if not exists last_error_at timestamptz,
  add column if not exists completion_actor_user_id uuid,
  add column if not exists completion_actor_email text,
  add column if not exists completion_actor_role text;

alter table public.account_lifecycle_operations
  drop constraint if exists account_lifecycle_operations_status_check,
  drop constraint if exists account_lifecycle_operations_check;

alter table public.account_lifecycle_operations
  add constraint account_lifecycle_operations_status_check
    check (
      status in ('PREPARED', 'IN_PROGRESS', 'RECOVERY_REQUIRED', 'COMPLETED')
    ),
  add constraint account_lifecycle_operations_attempt_count_check
    check (attempt_count >= 0),
  add constraint account_lifecycle_operations_lifecycle_state_check
    check (
      (
        status = 'PREPARED'
        and completed_at is null
        and completion_audit_id is null
        and attempt_count = 0
        and last_attempt_at is null
        and recovery_required_at is null
        and last_error_stage is null
        and last_error_code is null
        and last_error_at is null
      )
      or
      (
        status = 'IN_PROGRESS'
        and completed_at is null
        and completion_audit_id is null
        and attempt_count >= 1
        and last_attempt_at is not null
        and recovery_required_at is null
        and last_error_stage is null
        and last_error_code is null
        and last_error_at is null
      )
      or
      (
        status = 'RECOVERY_REQUIRED'
        and completed_at is null
        and completion_audit_id is null
        and attempt_count >= 1
        and last_attempt_at is not null
        and recovery_required_at is not null
        and last_error_stage is not null
        and last_error_code is not null
        and last_error_at is not null
      )
      or
      (
        status = 'COMPLETED'
        and completed_at is not null
        and completion_audit_id is not null
      )
    );

drop index if exists public.account_lifecycle_operations_prepared_idx;

create index account_lifecycle_operations_recovery_idx
  on public.account_lifecycle_operations (target_user_id, last_attempt_at desc)
  where status in ('PREPARED', 'IN_PROGRESS', 'RECOVERY_REQUIRED');

alter table public.account_lifecycle_operations enable row level security;

revoke all on table public.account_lifecycle_operations
  from public, anon, authenticated;
grant select, insert, update on table public.account_lifecycle_operations
  to service_role;

create or replace function public.genesis_account_lifecycle_begin_hard_delete_v2(
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
  v_open_operation public.account_lifecycle_operations%rowtype;
  v_sessions_revoked bigint := 0;
  v_rows_updated bigint := 0;
  v_storage_objects jsonb := '[]'::jsonb;
  v_storage_object_count bigint := 0;
  v_operation_id uuid;
  v_started_audit_id uuid;
begin
  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_target_user_id is null then
    return jsonb_build_object('allowed', false, 'code', 'INVALID_REQUEST');
  end if;

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

  select *
    into v_open_operation
  from public.account_lifecycle_operations operation_row
  where operation_row.target_user_id = p_target_user_id
    and operation_row.status in ('PREPARED', 'IN_PROGRESS', 'RECOVERY_REQUIRED')
  order by operation_row.started_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'allowed', false,
      'code', case
        when v_open_operation.status = 'IN_PROGRESS'
          then 'OPERATION_IN_PROGRESS'
        else 'RECOVERY_OPERATION_AVAILABLE'
      end,
      'operation_id', v_open_operation.id,
      'target_user_id', v_open_operation.target_user_id
    );
  end if;

  select actor.email::text, actor.role::text
    into v_actor_email, v_actor_role
  from public.users_master actor
  where actor.id = p_actor_user_id
    and actor.role::text = 'SUPER_ADMIN'
    and actor.account_status::text = 'ACTIVE'
  limit 1;

  if v_actor_role is null then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_FORBIDDEN');
  end if;

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
    raise exception 'GENESIS_C2A_EXECUTION_FAIL: hard-delete suspension mismatch';
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
    storage_objects,
    attempt_count,
    last_attempt_at
  )
  values (
    'HARD_DELETE',
    'IN_PROGRESS',
    p_actor_user_id,
    v_actor_email,
    v_actor_role,
    p_target_user_id,
    v_target_role,
    v_previous_status,
    v_sessions_revoked,
    v_storage_object_count,
    v_storage_objects,
    1,
    now()
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
      'storage_object_count', v_storage_object_count,
      'attempt_count', 1,
      'operation_status', 'IN_PROGRESS'
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
    'storage_objects', v_storage_objects,
    'attempt_count', 1,
    'recovered', false
  );
end
$function$;

create or replace function public.genesis_account_lifecycle_claim_hard_delete_recovery(
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
  v_operation public.account_lifecycle_operations%rowtype;
  v_attempt_count bigint;
  v_recovery_audit_id uuid;
begin
  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_target_user_id is null then
    return jsonb_build_object('allowed', false, 'code', 'INVALID_REQUEST');
  end if;

  if p_actor_user_id = p_target_user_id then
    return jsonb_build_object('allowed', false, 'code', 'SELF_ACTION_BLOCKED');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('genesis_account_lifecycle', 0)
  );

  if not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = p_actor_session_id
      and session_row.user_id = p_actor_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  ) then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_SESSION_INVALID');
  end if;

  select actor.email::text, actor.role::text
    into v_actor_email, v_actor_role
  from public.users_master actor
  where actor.id = p_actor_user_id
    and actor.role::text = 'SUPER_ADMIN'
    and actor.account_status::text = 'ACTIVE'
  limit 1;

  if v_actor_role is null then
    return jsonb_build_object('allowed', false, 'code', 'ACTOR_FORBIDDEN');
  end if;

  select *
    into v_operation
  from public.account_lifecycle_operations operation_row
  where operation_row.target_user_id = p_target_user_id
    and operation_row.status in ('PREPARED', 'IN_PROGRESS', 'RECOVERY_REQUIRED')
  order by operation_row.started_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'code', 'NO_RECOVERY_OPERATION'
    );
  end if;

  if v_operation.status = 'IN_PROGRESS'
     and v_operation.last_attempt_at is not null
     and v_operation.last_attempt_at > now() - interval '10 minutes' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'OPERATION_IN_PROGRESS',
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id,
      'retry_after_seconds',
        greatest(
          1,
          ceil(
            extract(
              epoch from (
                v_operation.last_attempt_at + interval '10 minutes' - now()
              )
            )
          )::integer
        )
    );
  end if;

  update public.account_lifecycle_operations
  set
    status = 'IN_PROGRESS',
    attempt_count = greatest(attempt_count, 0) + 1,
    last_attempt_at = now(),
    recovery_required_at = null,
    last_error_stage = null,
    last_error_code = null,
    last_error_at = null
  where id = v_operation.id
  returning attempt_count into v_attempt_count;

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
    'ACCOUNT_HARD_DELETE_RECOVERY_CLAIMED',
    jsonb_build_object(
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id,
      'target_role', v_operation.target_role,
      'original_actor_user_id', v_operation.actor_user_id,
      'original_actor_email', v_operation.actor_email,
      'attempt_count', v_attempt_count,
      'previous_operation_status', v_operation.status
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  )
  returning id into v_recovery_audit_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'RECOVERY_CLAIMED',
    'operation_id', v_operation.id,
    'target_user_id', v_operation.target_user_id,
    'target_role', v_operation.target_role,
    'target_status', 'SUSPENDED',
    'storage_object_count', v_operation.storage_object_count,
    'storage_objects', v_operation.storage_objects,
    'attempt_count', v_attempt_count,
    'recovered', true,
    'recovery_audit_id', v_recovery_audit_id
  );
end
$function$;

create or replace function public.genesis_account_lifecycle_mark_hard_delete_recovery_required(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_operation_id uuid,
  p_attempt_count bigint,
  p_failure_stage text,
  p_failure_code text,
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
  v_operation public.account_lifecycle_operations%rowtype;
  v_failure_stage text := upper(btrim(coalesce(p_failure_stage, '')));
  v_failure_code text := left(nullif(btrim(coalesce(p_failure_code, '')), ''), 128);
  v_recovery_audit_id uuid;
begin
  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_operation_id is null
     or p_attempt_count is null
     or p_attempt_count < 1
     or v_failure_code is null
     or v_failure_stage not in ('INVENTORY', 'STORAGE', 'CHAT', 'AUTH', 'FINALIZE') then
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

  select actor.email::text, actor.role::text
    into v_actor_email, v_actor_role
  from public.users_master actor
  where actor.id = p_actor_user_id
    and actor.role::text = 'SUPER_ADMIN'
    and actor.account_status::text = 'ACTIVE'
  limit 1;

  if v_actor_role is null then
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

  if v_operation.status = 'COMPLETED' then
    return jsonb_build_object(
      'allowed', true,
      'code', 'ALREADY_COMPLETED',
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id
    );
  end if;

  if v_operation.status = 'RECOVERY_REQUIRED'
     and v_operation.attempt_count = p_attempt_count then
    return jsonb_build_object(
      'allowed', true,
      'code', 'ALREADY_RECOVERY_REQUIRED',
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id
    );
  end if;

  if v_operation.status <> 'IN_PROGRESS'
     or v_operation.attempt_count <> p_attempt_count then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ATTEMPT_SUPERSEDED',
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id
    );
  end if;

  update public.account_lifecycle_operations
  set
    status = 'RECOVERY_REQUIRED',
    recovery_required_at = now(),
    last_error_stage = v_failure_stage,
    last_error_code = v_failure_code,
    last_error_at = now()
  where id = v_operation.id;

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
    'ACCOUNT_HARD_DELETE_RECOVERY_REQUIRED',
    jsonb_build_object(
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id,
      'target_role', v_operation.target_role,
      'attempt_count', v_operation.attempt_count,
      'failure_stage', v_failure_stage,
      'failure_code', v_failure_code
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  )
  returning id into v_recovery_audit_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'RECOVERY_REQUIRED',
    'operation_id', v_operation.id,
    'target_user_id', v_operation.target_user_id,
    'recovery_audit_id', v_recovery_audit_id
  );
end
$function$;

create or replace function public.genesis_account_lifecycle_finalize_hard_delete_v2(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_operation_id uuid,
  p_attempt_count bigint,
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
  v_operation public.account_lifecycle_operations%rowtype;
  v_completion_audit_id uuid;
begin
  if p_actor_user_id is null
     or p_actor_session_id is null
     or p_operation_id is null
     or p_attempt_count is null
     or p_attempt_count < 1 then
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

  select actor.email::text, actor.role::text
    into v_actor_email, v_actor_role
  from public.users_master actor
  where actor.id = p_actor_user_id
    and actor.role::text = 'SUPER_ADMIN'
    and actor.account_status::text = 'ACTIVE'
  limit 1;

  if v_actor_role is null then
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

  if v_operation.action <> 'HARD_DELETE' then
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

  if v_operation.status <> 'IN_PROGRESS' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'OPERATION_NOT_READY',
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id
    );
  end if;

  if v_operation.attempt_count <> p_attempt_count then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ATTEMPT_SUPERSEDED',
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
    p_actor_user_id,
    v_actor_email,
    v_actor_role,
    'ACCOUNT_HARD_DELETE_COMPLETED',
    jsonb_build_object(
      'operation_id', v_operation.id,
      'target_user_id', v_operation.target_user_id,
      'target_role', v_operation.target_role,
      'previous_status', v_operation.previous_status,
      'sessions_revoked', v_operation.sessions_revoked,
      'storage_object_count', v_operation.storage_object_count,
      'storage_objects_deleted', v_operation.storage_object_count,
      'attempt_count', v_operation.attempt_count,
      'completion_mode', case
        when v_operation.attempt_count > 1 then 'RECONCILED'
        else 'INITIAL'
      end,
      'original_actor_user_id', v_operation.actor_user_id,
      'original_actor_email', v_operation.actor_email,
      'completion_actor_user_id', p_actor_user_id,
      'completion_actor_email', v_actor_email
    )::text,
    left(nullif(btrim(p_ip_address), ''), 128)
  )
  returning id into v_completion_audit_id;

  update public.account_lifecycle_operations
  set
    status = 'COMPLETED',
    completed_at = now(),
    completion_audit_id = v_completion_audit_id,
    completion_actor_user_id = p_actor_user_id,
    completion_actor_email = v_actor_email,
    completion_actor_role = v_actor_role
  where id = v_operation.id;

  return jsonb_build_object(
    'allowed', true,
    'code', case
      when v_operation.attempt_count > 1 then 'RECONCILED'
      else 'OK'
    end,
    'operation_id', v_operation.id,
    'target_user_id', v_operation.target_user_id
  );
end
$function$;

revoke all on function public.genesis_account_lifecycle_begin_hard_delete_v2(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.genesis_account_lifecycle_begin_hard_delete_v2(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.genesis_account_lifecycle_claim_hard_delete_recovery(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.genesis_account_lifecycle_claim_hard_delete_recovery(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.genesis_account_lifecycle_mark_hard_delete_recovery_required(uuid, uuid, uuid, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.genesis_account_lifecycle_mark_hard_delete_recovery_required(uuid, uuid, uuid, bigint, text, text, text)
  to service_role;

revoke all on function public.genesis_account_lifecycle_finalize_hard_delete_v2(uuid, uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.genesis_account_lifecycle_finalize_hard_delete_v2(uuid, uuid, uuid, bigint, text)
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
    raise exception 'GENESIS_C2A_ASSERTION_FAILED: ledger RLS is not enabled';
  end if;

  if has_table_privilege('anon', 'public.account_lifecycle_operations', 'select')
     or has_table_privilege('authenticated', 'public.account_lifecycle_operations', 'select') then
    raise exception 'GENESIS_C2A_ASSERTION_FAILED: browser role can read ledger';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.account_lifecycle_operations',
    'select,insert,update'
  ) then
    raise exception 'GENESIS_C2A_ASSERTION_FAILED: service role lacks ledger access';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public'
      and function_row.proname in (
        'genesis_account_lifecycle_begin_hard_delete_v2',
        'genesis_account_lifecycle_claim_hard_delete_recovery',
        'genesis_account_lifecycle_mark_hard_delete_recovery_required',
        'genesis_account_lifecycle_finalize_hard_delete_v2'
      )
      and (
        not function_row.prosecdef
        or coalesce(array_to_string(function_row.proconfig, ','), '') not like '%search_path=%'
      )
  ) then
    raise exception 'GENESIS_C2A_ASSERTION_FAILED: reconciliation function security settings invalid';
  end if;

  if has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_begin_hard_delete_v2(uuid,uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_begin_hard_delete_v2(uuid,uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_claim_hard_delete_recovery(uuid,uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_claim_hard_delete_recovery(uuid,uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_mark_hard_delete_recovery_required(uuid,uuid,uuid,bigint,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_mark_hard_delete_recovery_required(uuid,uuid,uuid,bigint,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.genesis_account_lifecycle_finalize_hard_delete_v2(uuid,uuid,uuid,bigint,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.genesis_account_lifecycle_finalize_hard_delete_v2(uuid,uuid,uuid,bigint,text)',
       'execute'
     ) then
    raise exception 'GENESIS_C2A_ASSERTION_FAILED: browser role can execute reconciliation RPC';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_begin_hard_delete_v2(uuid,uuid,uuid,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_claim_hard_delete_recovery(uuid,uuid,uuid,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_mark_hard_delete_recovery_required(uuid,uuid,uuid,bigint,text,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.genesis_account_lifecycle_finalize_hard_delete_v2(uuid,uuid,uuid,bigint,text)',
       'execute'
     ) then
    raise exception 'GENESIS_C2A_ASSERTION_FAILED: service role lacks reconciliation execute access';
  end if;
end
$assertions$;
