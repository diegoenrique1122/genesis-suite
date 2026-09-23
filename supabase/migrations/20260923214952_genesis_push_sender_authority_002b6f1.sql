-- GENESIS OS
-- C3B14.2C.3C.1 - Secure Push Sender Authority
--
-- Responsibilities:
--   1. Recover abandoned PROCESSING leases.
--   2. Reject jobs whose destination is no longer valid.
--   3. Atomically claim delivery jobs with SKIP LOCKED.
--   4. Settle a claimed job as DELIVERED, RETRY, GONE, or DEAD.
--   5. Keep all Push delivery authority server-side.
--
-- These RPCs are intentionally SECURITY INVOKER.
-- Only service_role receives EXECUTE.

do $preconditions$
begin
  if to_regclass(
    'public.push_delivery_jobs'
  ) is null then
    raise exception
      'GENESIS_PUSH_SENDER_JOBS_MISSING';
  end if;

  if to_regclass(
    'public.push_subscriptions'
  ) is null then
    raise exception
      'GENESIS_PUSH_SENDER_SUBSCRIPTIONS_MISSING';
  end if;

  if to_regclass(
    'public.system_notifications'
  ) is null then
    raise exception
      'GENESIS_PUSH_SENDER_NOTIFICATIONS_MISSING';
  end if;

  if to_regclass(
    'public.users_master'
  ) is null then
    raise exception
      'GENESIS_PUSH_SENDER_USERS_MISSING';
  end if;

  if to_regprocedure(
    'public.genesis_claim_push_delivery_jobs(integer)'
  ) is not null then
    raise exception
      'GENESIS_PUSH_SENDER_CLAIM_RPC_ALREADY_EXISTS';
  end if;

  if to_regprocedure(
    'public.genesis_settle_push_delivery(uuid,text,integer,text,integer)'
  ) is not null then
    raise exception
      'GENESIS_PUSH_SENDER_SETTLE_RPC_ALREADY_EXISTS';
  end if;
end;
$preconditions$;


create function
public.genesis_claim_push_delivery_jobs(
  p_limit integer default 10
)
returns table (
  job_id uuid,
  notification_id uuid,
  subscription_id uuid,
  recipient_id uuid,

  endpoint text,
  p256dh text,
  auth_secret text,

  title text,
  message text,
  notification_type text,

  resource_type text,
  resource_id uuid,

  recipient_role text,

  attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if
    p_limit is null
    or p_limit < 1
    or p_limit > 50
  then
    raise exception
      'GENESIS_PUSH_CLAIM_LIMIT_INVALID';
  end if;


  -- Recover jobs left PROCESSING by a crashed or terminated
  -- sender invocation. claimed_at acts as the delivery lease.
  update public.push_delivery_jobs
  set
    status = 'RETRY',
    claimed_at = null,
    available_at = pg_catalog.now(),
    last_error_code = 'CLAIM_TIMEOUT',
    last_error_at = pg_catalog.now()
  where status = 'PROCESSING'
    and claimed_at <
      pg_catalog.now() -
      interval '5 minutes';


  -- A queued destination can become invalid after enqueueing.
  -- Never send to disabled/expired subscriptions or inactive
  -- Genesis identities.
  update public.push_delivery_jobs as job
  set
    status = 'DEAD',
    claimed_at = null,
    last_error_code =
      case
        when subscription.user_id <> job.recipient_id
          then 'SUBSCRIPTION_OWNER_MISMATCH'

        when subscription.disabled_at is not null
          then 'SUBSCRIPTION_DISABLED'

        when
          subscription.expires_at is not null
          and subscription.expires_at <= pg_catalog.now()
          then 'SUBSCRIPTION_EXPIRED'

        when identity.account_status::text <> 'ACTIVE'
          then 'RECIPIENT_INACTIVE'

        else 'DESTINATION_INVALID'
      end,
    last_error_at = pg_catalog.now()
  from
    public.push_subscriptions as subscription,
    public.users_master as identity
  where job.subscription_id =
      subscription.id

    and job.recipient_id =
      identity.id

    and job.status in (
      'PENDING',
      'RETRY'
    )

    and (
      subscription.user_id <>
        job.recipient_id

      or subscription.disabled_at
        is not null

      or (
        subscription.expires_at
          is not null
        and subscription.expires_at <=
          pg_catalog.now()
      )

      or identity.account_status::text <>
        'ACTIVE'
    );


  return query

  with candidates as (
    select job.id
    from public.push_delivery_jobs
      as job

    join public.push_subscriptions
      as subscription
      on subscription.id =
        job.subscription_id

    join public.users_master
      as identity
      on identity.id =
        job.recipient_id

    where job.status in (
        'PENDING',
        'RETRY'
      )

      and job.available_at <=
        pg_catalog.now()

      and subscription.user_id =
        job.recipient_id

      and subscription.disabled_at
        is null

      and (
        subscription.expires_at is null
        or subscription.expires_at >
          pg_catalog.now()
      )

      and identity.account_status::text =
        'ACTIVE'

    order by
      job.available_at,
      job.created_at,
      job.id

    for update of job
    skip locked

    limit p_limit
  ),

  claimed as (
    update public.push_delivery_jobs
      as job

    set
      status = 'PROCESSING',
      claimed_at = pg_catalog.now(),
      attempt_count =
        job.attempt_count + 1

    from candidates

    where job.id =
      candidates.id

    returning
      job.id,
      job.notification_id,
      job.subscription_id,
      job.recipient_id,
      job.attempt_count
  )

  select
    claimed.id as job_id,
    claimed.notification_id,
    claimed.subscription_id,
    claimed.recipient_id,

    subscription.endpoint,
    subscription.p256dh,
    subscription.auth_secret,

    notification.title,
    notification.message,
    notification.type
      as notification_type,

    notification.resource_type,
    notification.resource_id,

    identity.role::text
      as recipient_role,

    claimed.attempt_count

  from claimed

  join public.push_subscriptions
    as subscription
    on subscription.id =
      claimed.subscription_id

  join public.system_notifications
    as notification
    on notification.id =
      claimed.notification_id

  join public.users_master
    as identity
    on identity.id =
      claimed.recipient_id

  order by
    claimed.id;
end;
$function$;


revoke all
on function
public.genesis_claim_push_delivery_jobs(integer)
from public, anon, authenticated;


grant execute
on function
public.genesis_claim_push_delivery_jobs(integer)
to service_role;


create function
public.genesis_settle_push_delivery(
  p_job_id uuid,
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
  from public.push_delivery_jobs
    as job
  where job.id =
    p_job_id
  for update;


  if not found then
    raise exception
      'GENESIS_PUSH_SETTLE_JOB_NOT_FOUND';
  end if;


  -- Safe replay behavior for a response that was already
  -- persisted before the caller lost its HTTP response.
  if v_job.status in (
    'DELIVERED',
    'DEAD'
  ) then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'code', 'ALREADY_SETTLED',
      'job_id', v_job.id,
      'status', v_job.status,
      'attempt_count', v_job.attempt_count
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
      delivered_at = pg_catalog.now(),
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
    'attempt_count', v_job.attempt_count,
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
  text,
  integer,
  text,
  integer
)
from public, anon, authenticated;


grant execute
on function
public.genesis_settle_push_delivery(
  uuid,
  text,
  integer,
  text,
  integer
)
to service_role;


do $postconditions$
declare
  v_claim_oid oid;
  v_settle_oid oid;

  v_claim_secure boolean;
  v_settle_secure boolean;
begin
  v_claim_oid :=
    to_regprocedure(
      'public.genesis_claim_push_delivery_jobs(integer)'
    );

  v_settle_oid :=
    to_regprocedure(
      'public.genesis_settle_push_delivery(uuid,text,integer,text,integer)'
    );


  if
    v_claim_oid is null
    or v_settle_oid is null
  then
    raise exception
      'GENESIS_PUSH_SENDER_RPC_MISSING';
  end if;


  select
    not procedure_row.prosecdef

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
  into v_claim_secure
  from pg_catalog.pg_proc
    as procedure_row
  where procedure_row.oid =
    v_claim_oid;


  select
    not procedure_row.prosecdef

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
  into v_settle_secure
  from pg_catalog.pg_proc
    as procedure_row
  where procedure_row.oid =
    v_settle_oid;


  if
    not coalesce(
      v_claim_secure,
      false
    )
    or
    not coalesce(
      v_settle_secure,
      false
    )
  then
    raise exception
      'GENESIS_PUSH_SENDER_AUTHORITY_VERIFY_FAILED';
  end if;
end;
$postconditions$;


notify pgrst, 'reload schema';