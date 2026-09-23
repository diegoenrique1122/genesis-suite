-- Genesis OS
-- C3B14.2C.3C.1A
-- Push delivery settlement lease fencing.
--
-- attempt_count is the fencing token for a claimed delivery lease.
-- A stale worker must never be able to settle a newer claim.

do $precondition$
begin
  if pg_catalog.to_regprocedure(
    'public.genesis_claim_push_delivery_jobs(integer)'
  ) is null then
    raise exception
      'GENESIS_PUSH_FENCING_CLAIM_RPC_MISSING';
  end if;


  if pg_catalog.to_regprocedure(
    'public.genesis_settle_push_delivery(uuid,text,integer,text,integer)'
  ) is null then
    raise exception
      'GENESIS_PUSH_FENCING_OLD_SETTLE_RPC_MISSING';
  end if;


  if pg_catalog.to_regprocedure(
    'public.genesis_settle_push_delivery(uuid,integer,text,integer,text,integer)'
  ) is not null then
    raise exception
      'GENESIS_PUSH_FENCING_NEW_SETTLE_RPC_ALREADY_EXISTS';
  end if;


  if exists (
    select 1
    from public.push_delivery_jobs
    where status = 'PROCESSING'
  ) then
    raise exception
      'GENESIS_PUSH_FENCING_ACTIVE_LEASES_PRESENT';
  end if;
end;
$precondition$;


drop function
  public.genesis_settle_push_delivery(
    uuid,
    text,
    integer,
    text,
    integer
  );


create function
  public.genesis_settle_push_delivery(
    p_job_id uuid,
    p_expected_attempt_count integer,
    p_outcome text,
    p_http_status integer default null,
    p_error_code text default null,
    p_retry_after_seconds integer default null
  )
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_job public.push_delivery_jobs%rowtype;

  v_outcome text;

  v_error_code text;

  v_retry_seconds integer;

  v_final_status text;
begin
  if p_job_id is null then
    raise exception
      'GENESIS_PUSH_SETTLE_JOB_REQUIRED';
  end if;


  if
    p_expected_attempt_count is null
    or p_expected_attempt_count < 1
  then
    raise exception
      'GENESIS_PUSH_SETTLE_ATTEMPT_REQUIRED';
  end if;


  v_outcome :=
    pg_catalog.upper(
      pg_catalog.btrim(
        coalesce(
          p_outcome,
          ''
        )
      )
    );


  if v_outcome not in (
    'DELIVERED',
    'RETRY',
    'GONE',
    'DEAD'
  ) then
    raise exception
      'GENESIS_PUSH_SETTLE_OUTCOME_INVALID';
  end if;


  if
    p_http_status is not null
    and (
      p_http_status < 100
      or p_http_status > 599
    )
  then
    raise exception
      'GENESIS_PUSH_SETTLE_HTTP_STATUS_INVALID';
  end if;


  v_error_code :=
    nullif(
      pg_catalog.upper(
        pg_catalog.btrim(
          coalesce(
            p_error_code,
            ''
          )
        )
      ),
      ''
    );


  if
    v_error_code is not null
    and pg_catalog.char_length(
      v_error_code
    ) > 120
  then
    raise exception
      'GENESIS_PUSH_SETTLE_ERROR_CODE_TOO_LONG';
  end if;


  if
    p_retry_after_seconds is not null
    and (
      p_retry_after_seconds < 1
      or p_retry_after_seconds > 86400
    )
  then
    raise exception
      'GENESIS_PUSH_SETTLE_RETRY_AFTER_INVALID';
  end if;


  if
    v_outcome = 'GONE'
    and (
      p_http_status is null
      or p_http_status not in (
        404,
        410
      )
    )
  then
    raise exception
      'GENESIS_PUSH_SETTLE_GONE_STATUS_INVALID';
  end if;


  if
    v_outcome = 'DELIVERED'
    and p_http_status is not null
    and (
      p_http_status < 200
      or p_http_status > 299
    )
  then
    raise exception
      'GENESIS_PUSH_SETTLE_DELIVERED_STATUS_INVALID';
  end if;


  select job.*
  into v_job
  from public.push_delivery_jobs as job
  where job.id = p_job_id
  for update;


  if not found then
    raise exception
      'GENESIS_PUSH_SETTLE_JOB_NOT_FOUND';
  end if;


  /*
   * Fencing invariant:
   *
   * claim increments attempt_count.
   * The settlement caller must present that exact value.
   */
  if
    v_job.attempt_count <>
    p_expected_attempt_count
  then
    raise exception
      'GENESIS_PUSH_SETTLE_STALE_CLAIM';
  end if;


  /*
   * A repeated settlement response from the same attempt is safe.
   */
  if v_job.status in (
    'DELIVERED',
    'DEAD'
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'code', 'ALREADY_SETTLED',
      'job_id', v_job.id,
      'status', v_job.status,
      'attempt_count',
        v_job.attempt_count
    );
  end if;


  if v_job.status <> 'PROCESSING' then
    raise exception
      'GENESIS_PUSH_SETTLE_JOB_NOT_PROCESSING';
  end if;


  if v_outcome = 'DELIVERED' then

    update public.push_delivery_jobs
    set
      status = 'DELIVERED',
      claimed_at = null,
      delivered_at =
        pg_catalog.now(),
      last_http_status =
        p_http_status,
      last_error_code = null,
      last_error_at = null
    where id =
      v_job.id;


    update public.push_subscriptions
    set
      failure_count = 0,
      last_failure_at = null
    where id =
      v_job.subscription_id;


    v_final_status :=
      'DELIVERED';


  elsif v_outcome = 'GONE' then

    update public.push_delivery_jobs
    set
      status = 'DEAD',
      claimed_at = null,
      last_http_status =
        p_http_status,
      last_error_code =
        coalesce(
          v_error_code,
          'PUSH_GONE'
        ),
      last_error_at =
        pg_catalog.now()
    where id =
      v_job.id;


    update public.push_subscriptions
    set
      disabled_at =
        coalesce(
          disabled_at,
          pg_catalog.now()
        ),
      failure_count =
        failure_count + 1,
      last_failure_at =
        pg_catalog.now()
    where id =
      v_job.subscription_id;


    v_final_status :=
      'DEAD';


  elsif v_outcome = 'DEAD' then

    update public.push_delivery_jobs
    set
      status = 'DEAD',
      claimed_at = null,
      last_http_status =
        p_http_status,
      last_error_code =
        coalesce(
          v_error_code,
          'DELIVERY_DEAD'
        ),
      last_error_at =
        pg_catalog.now()
    where id =
      v_job.id;


    update public.push_subscriptions
    set
      failure_count =
        failure_count + 1,
      last_failure_at =
        pg_catalog.now()
    where id =
      v_job.subscription_id;


    v_final_status :=
      'DEAD';


  else

    if v_job.attempt_count >= 5 then

      update public.push_delivery_jobs
      set
        status = 'DEAD',
        claimed_at = null,
        last_http_status =
          p_http_status,
        last_error_code =
          coalesce(
            v_error_code,
            'MAX_ATTEMPTS_REACHED'
          ),
        last_error_at =
          pg_catalog.now()
      where id =
        v_job.id;


      update public.push_subscriptions
      set
        failure_count =
          failure_count + 1,
        last_failure_at =
          pg_catalog.now()
      where id =
        v_job.subscription_id;


      v_final_status :=
        'DEAD';


    else

      v_retry_seconds :=
        coalesce(
          p_retry_after_seconds,
          case v_job.attempt_count
            when 1 then 60
            when 2 then 300
            when 3 then 900
            when 4 then 3600
            else 14400
          end
        );


      update public.push_delivery_jobs
      set
        status = 'RETRY',
        claimed_at = null,
        available_at =
          pg_catalog.now() +
          pg_catalog.make_interval(
            secs => v_retry_seconds
          ),
        last_http_status =
          p_http_status,
        last_error_code =
          coalesce(
            v_error_code,
            'DELIVERY_RETRY'
          ),
        last_error_at =
          pg_catalog.now()
      where id =
        v_job.id;


      update public.push_subscriptions
      set
        failure_count =
          failure_count + 1,
        last_failure_at =
          pg_catalog.now()
      where id =
        v_job.subscription_id;


      v_final_status :=
        'RETRY';

    end if;

  end if;


  return pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'job_id', v_job.id,
    'status', v_final_status,
    'attempt_count',
      v_job.attempt_count,
    'retry_after_seconds',
      case
        when v_final_status = 'RETRY'
          then v_retry_seconds
        else null
      end
  );
end;
$function$;


revoke all
on function
  public.genesis_settle_push_delivery(
    uuid,
    integer,
    text,
    integer,
    text,
    integer
  )
from
  public,
  anon,
  authenticated,
  service_role;


grant execute
on function
  public.genesis_settle_push_delivery(
    uuid,
    integer,
    text,
    integer,
    text,
    integer
  )
to service_role;


comment on function
  public.genesis_settle_push_delivery(
    uuid,
    integer,
    text,
    integer,
    text,
    integer
  )
is
  'Settles a claimed Push job only when the caller presents the current attempt_count fencing token. Prevents stale workers from settling newer leases. Service-role authority only.';


do $postcondition$
declare
  v_new_oid oid;

  v_security_definer boolean;
begin
  if pg_catalog.to_regprocedure(
    'public.genesis_settle_push_delivery(uuid,text,integer,text,integer)'
  ) is not null then
    raise exception
      'GENESIS_PUSH_FENCING_OLD_SETTLE_RPC_STILL_EXISTS';
  end if;


  v_new_oid :=
    pg_catalog.to_regprocedure(
      'public.genesis_settle_push_delivery(uuid,integer,text,integer,text,integer)'
    );


  if v_new_oid is null then
    raise exception
      'GENESIS_PUSH_FENCING_NEW_SETTLE_RPC_MISSING';
  end if;


  select p.prosecdef
  into v_security_definer
  from pg_catalog.pg_proc as p
  where p.oid = v_new_oid;


  if v_security_definer then
    raise exception
      'GENESIS_PUSH_FENCING_SETTLE_MUST_BE_SECURITY_INVOKER';
  end if;


  if pg_catalog.has_function_privilege(
    'anon',
    v_new_oid,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_FENCING_ANON_EXECUTE_PRESENT';
  end if;


  if pg_catalog.has_function_privilege(
    'authenticated',
    v_new_oid,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_FENCING_AUTH_EXECUTE_PRESENT';
  end if;


  if not pg_catalog.has_function_privilege(
    'service_role',
    v_new_oid,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_FENCING_SERVICE_ROLE_EXECUTE_MISSING';
  end if;
end;
$postcondition$;


notify pgrst, 'reload schema';