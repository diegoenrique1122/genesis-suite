-- GENESIS OS
-- C3B14.2C.3B - Durable Push Delivery Ledger
--
-- system_notifications remains the canonical event source.
-- push_subscriptions remains the delivery destination registry.
-- push_delivery_jobs is operational delivery state only.
--
-- Important:
--   - No historical notification backfill.
--   - No browser/client table access.
--   - No direct role-based broadcast.
--   - Every job belongs to one notification, one recipient,
--     and one concrete Push subscription.

do $preconditions$
begin
  if to_regnamespace('private') is null then
    raise exception
      'GENESIS_PUSH_DELIVERY_PRIVATE_SCHEMA_MISSING';
  end if;

  if to_regclass(
    'public.system_notifications'
  ) is null then
    raise exception
      'GENESIS_PUSH_DELIVERY_NOTIFICATIONS_MISSING';
  end if;

  if to_regclass(
    'public.push_subscriptions'
  ) is null then
    raise exception
      'GENESIS_PUSH_DELIVERY_SUBSCRIPTIONS_MISSING';
  end if;

  if to_regclass(
    'public.users_master'
  ) is null then
    raise exception
      'GENESIS_PUSH_DELIVERY_USERS_MASTER_MISSING';
  end if;

  if to_regclass(
    'public.push_delivery_jobs'
  ) is not null then
    raise exception
      'GENESIS_PUSH_DELIVERY_JOBS_ALREADY_EXISTS';
  end if;

  if to_regprocedure(
    'private.genesis_enqueue_push_deliveries()'
  ) is not null then
    raise exception
      'GENESIS_PUSH_DELIVERY_ENQUEUE_FUNCTION_EXISTS';
  end if;
end;
$preconditions$;


create table public.push_delivery_jobs (
  id uuid primary key
    default gen_random_uuid(),

  notification_id uuid not null
    references public.system_notifications(id)
    on delete cascade,

  subscription_id uuid not null
    references public.push_subscriptions(id)
    on delete cascade,

  recipient_id uuid not null
    references public.users_master(id)
    on delete cascade,

  status text not null
    default 'PENDING',

  attempt_count integer not null
    default 0,

  available_at timestamptz not null
    default now(),

  claimed_at timestamptz,

  delivered_at timestamptz,

  last_http_status integer,

  last_error_code text,

  last_error_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint push_delivery_jobs_unique_delivery
    unique (
      notification_id,
      subscription_id
    ),

  constraint push_delivery_jobs_status_check
    check (
      status in (
        'PENDING',
        'PROCESSING',
        'RETRY',
        'DELIVERED',
        'DEAD'
      )
    ),

  constraint push_delivery_jobs_attempt_count_check
    check (
      attempt_count >= 0
    ),

  constraint push_delivery_jobs_http_status_check
    check (
      last_http_status is null
      or last_http_status between 100 and 599
    ),

  constraint push_delivery_jobs_error_code_length_check
    check (
      last_error_code is null
      or char_length(last_error_code) <= 120
    ),

  constraint push_delivery_jobs_delivered_state_check
    check (
      status <> 'DELIVERED'
      or delivered_at is not null
    ),

  constraint push_delivery_jobs_processing_state_check
    check (
      status <> 'PROCESSING'
      or claimed_at is not null
    )
);


comment on table public.push_delivery_jobs is
  'Durable operational queue for Genesis Web Push delivery. system_notifications remains the canonical notification source.';

comment on column public.push_delivery_jobs.notification_id is
  'Canonical Genesis notification being delivered.';

comment on column public.push_delivery_jobs.subscription_id is
  'Concrete browser Push subscription selected for this delivery.';

comment on column public.push_delivery_jobs.recipient_id is
  'Canonical Genesis identity that owns both the notification and target subscription.';

comment on column public.push_delivery_jobs.status is
  'Delivery state: PENDING, PROCESSING, RETRY, DELIVERED, or DEAD.';


create index push_delivery_jobs_ready_idx
on public.push_delivery_jobs (
  status,
  available_at,
  created_at
)
where status in (
  'PENDING',
  'RETRY'
);


create index push_delivery_jobs_recipient_idx
on public.push_delivery_jobs (
  recipient_id,
  created_at desc
);


create index push_delivery_jobs_subscription_idx
on public.push_delivery_jobs (
  subscription_id,
  created_at desc
);


revoke all
on table public.push_delivery_jobs
from public, anon, authenticated;


grant
  select,
  insert,
  update,
  delete
on table public.push_delivery_jobs
to service_role;


alter table public.push_delivery_jobs
enable row level security;


alter table public.push_delivery_jobs
force row level security;


-- Intentionally no authenticated RLS policy.
-- Browser/client code must never read delivery jobs or Push secrets.


create or replace function
private.genesis_touch_push_delivery_job()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at :=
    pg_catalog.now();

  return new;
end;
$function$;


revoke all
on function
private.genesis_touch_push_delivery_job()
from public, anon, authenticated, service_role;


create trigger trg_genesis_touch_push_delivery_job
before update
on public.push_delivery_jobs
for each row
execute function
private.genesis_touch_push_delivery_job();


create or replace function
private.genesis_enqueue_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Push delivery is always identity-specific.
  -- Never derive a Push audience from recipient_role alone.
  if new.recipient_id is null then
    return new;
  end if;


  -- Do not enqueue delivery for an identity that is no
  -- longer an active Genesis account.
  if not exists (
    select 1
    from public.users_master as identity
    where identity.id =
      new.recipient_id
      and identity.account_status::text =
        'ACTIVE'
  ) then
    return new;
  end if;


  insert into public.push_delivery_jobs (
    notification_id,
    subscription_id,
    recipient_id
  )
  select
    new.id,
    subscription.id,
    new.recipient_id
  from public.push_subscriptions
    as subscription
  where subscription.user_id =
      new.recipient_id

    and subscription.disabled_at
      is null

    and (
      subscription.expires_at is null
      or subscription.expires_at >
        pg_catalog.now()
    )

  on conflict (
    notification_id,
    subscription_id
  )
  do nothing;


  return new;
end;
$function$;


revoke all
on function
private.genesis_enqueue_push_deliveries()
from public, anon, authenticated, service_role;


create trigger trg_genesis_enqueue_push_deliveries
after insert
on public.system_notifications
for each row
execute function
private.genesis_enqueue_push_deliveries();


do $postconditions$
declare
  v_rls_enabled boolean;
  v_rls_forced boolean;

  v_authenticated_access boolean;
  v_service_role_access boolean;

  v_policy_count integer;

  v_unique_constraint boolean;

  v_touch_trigger boolean;
  v_enqueue_trigger boolean;

  v_enqueue_secure boolean;
begin
  select
    relation.relrowsecurity,
    relation.relforcerowsecurity
  into
    v_rls_enabled,
    v_rls_forced
  from pg_catalog.pg_class
    as relation
  where relation.oid =
    'public.push_delivery_jobs'::regclass;


  v_authenticated_access :=
    has_table_privilege(
      'authenticated',
      'public.push_delivery_jobs',
      'SELECT'
    )
    or
    has_table_privilege(
      'authenticated',
      'public.push_delivery_jobs',
      'INSERT'
    )
    or
    has_table_privilege(
      'authenticated',
      'public.push_delivery_jobs',
      'UPDATE'
    )
    or
    has_table_privilege(
      'authenticated',
      'public.push_delivery_jobs',
      'DELETE'
    );


  v_service_role_access :=
    has_table_privilege(
      'service_role',
      'public.push_delivery_jobs',
      'SELECT'
    )
    and
    has_table_privilege(
      'service_role',
      'public.push_delivery_jobs',
      'INSERT'
    )
    and
    has_table_privilege(
      'service_role',
      'public.push_delivery_jobs',
      'UPDATE'
    )
    and
    has_table_privilege(
      'service_role',
      'public.push_delivery_jobs',
      'DELETE'
    );


  select
    pg_catalog.count(*)::integer
  into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename =
      'push_delivery_jobs';


  select exists (
    select 1
    from pg_catalog.pg_constraint
      as constraint_row
    where constraint_row.conrelid =
      'public.push_delivery_jobs'::regclass
      and constraint_row.conname =
        'push_delivery_jobs_unique_delivery'
  )
  into v_unique_constraint;


  select exists (
    select 1
    from pg_catalog.pg_trigger
      as trigger_row
    where trigger_row.tgrelid =
      'public.push_delivery_jobs'::regclass
      and trigger_row.tgname =
        'trg_genesis_touch_push_delivery_job'
      and not trigger_row.tgisinternal
  )
  into v_touch_trigger;


  select exists (
    select 1
    from pg_catalog.pg_trigger
      as trigger_row
    where trigger_row.tgrelid =
      'public.system_notifications'::regclass
      and trigger_row.tgname =
        'trg_genesis_enqueue_push_deliveries'
      and not trigger_row.tgisinternal
  )
  into v_enqueue_trigger;


  select
    procedure_row.prosecdef
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
    and not has_function_privilege(
      'service_role',
      procedure_row.oid,
      'EXECUTE'
    )
  into v_enqueue_secure
  from pg_catalog.pg_proc
    as procedure_row
  where procedure_row.oid =
    to_regprocedure(
      'private.genesis_enqueue_push_deliveries()'
    );


  if
    not coalesce(v_rls_enabled, false)
    or
    not coalesce(v_rls_forced, false)
    or
    coalesce(v_authenticated_access, true)
    or
    not coalesce(v_service_role_access, false)
    or
    coalesce(v_policy_count, -1) <> 0
    or
    not coalesce(v_unique_constraint, false)
    or
    not coalesce(v_touch_trigger, false)
    or
    not coalesce(v_enqueue_trigger, false)
    or
    not coalesce(v_enqueue_secure, false)
  then
    raise exception
      'GENESIS_PUSH_DELIVERY_LEDGER_VERIFY_FAILED';
  end if;
end;
$postconditions$;


notify pgrst, 'reload schema';