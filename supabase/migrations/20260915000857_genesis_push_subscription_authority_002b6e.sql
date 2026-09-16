-- GENESIS OS
-- C3B14.2C.1 — Secure Push Subscription Authority
--
-- system_notifications remains the canonical notification source.
-- push_subscriptions stores delivery credentials only.
--
-- Authenticated browser clients have no direct table access.
-- Public RPCs are SECURITY INVOKER facades.
-- Privileged mutation logic remains in the non-exposed private schema.

do $preconditions$
begin
  if to_regnamespace('private') is null then
    raise exception 'GENESIS_PUSH_PRIVATE_SCHEMA_MISSING';
  end if;

  if to_regclass('public.users_master') is null then
    raise exception 'GENESIS_PUSH_USERS_MASTER_MISSING';
  end if;

  if to_regclass('public.system_notifications') is null then
    raise exception 'GENESIS_PUSH_SYSTEM_NOTIFICATIONS_MISSING';
  end if;

  if to_regclass('public.push_subscriptions') is not null then
    raise exception 'GENESIS_PUSH_SUBSCRIPTIONS_ALREADY_EXISTS';
  end if;

  if
    to_regprocedure(
      'private.genesis_register_push_subscription(text,text,text,timestamptz,text)'
    ) is not null
    or
    to_regprocedure(
      'private.genesis_unregister_push_subscription(text)'
    ) is not null
    or
    to_regprocedure(
      'public.genesis_register_push_subscription(text,text,text,timestamptz,text)'
    ) is not null
    or
    to_regprocedure(
      'public.genesis_unregister_push_subscription(text)'
    ) is not null
  then
    raise exception 'GENESIS_PUSH_RPC_ALREADY_EXISTS';
  end if;
end;
$preconditions$;


create table public.push_subscriptions (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    references public.users_master(id)
    on delete cascade,

  endpoint text not null,

  p256dh text not null,

  auth_secret text not null,

  expires_at timestamptz,

  user_agent text,

  disabled_at timestamptz,

  failure_count integer not null
    default 0
    check (failure_count >= 0),

  last_failure_at timestamptz,

  last_seen_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint push_subscriptions_endpoint_unique
    unique (endpoint),

  constraint push_subscriptions_endpoint_length_check
    check (
      char_length(endpoint)
      between 16 and 4096
    ),

  constraint push_subscriptions_endpoint_https_check
    check (
      endpoint ~ '^https://[^[:space:]]+$'
    ),

  constraint push_subscriptions_p256dh_length_check
    check (
      char_length(p256dh)
      between 16 and 512
    ),

  constraint push_subscriptions_p256dh_encoding_check
    check (
      p256dh ~ '^[A-Za-z0-9_-]+$'
    ),

  constraint push_subscriptions_auth_secret_length_check
    check (
      char_length(auth_secret)
      between 8 and 256
    ),

  constraint push_subscriptions_auth_secret_encoding_check
    check (
      auth_secret ~ '^[A-Za-z0-9_-]+$'
    ),

  constraint push_subscriptions_user_agent_length_check
    check (
      user_agent is null
      or char_length(user_agent) <= 1024
    ),

  constraint push_subscriptions_expiry_check
    check (
      expires_at is null
      or expires_at > created_at
    )
);


comment on table public.push_subscriptions is
  'Web Push delivery endpoints. system_notifications remains the canonical Genesis notification source.';

comment on column public.push_subscriptions.user_id is
  'Canonical Genesis identity that owns this browser push subscription.';

comment on column public.push_subscriptions.endpoint is
  'Unique browser push-service endpoint. One endpoint cannot belong to multiple Genesis identities.';

comment on column public.push_subscriptions.p256dh is
  'Web Push public encryption key. Hidden from ordinary authenticated table access.';

comment on column public.push_subscriptions.auth_secret is
  'Web Push authentication secret. Hidden from ordinary authenticated table access.';

comment on column public.push_subscriptions.disabled_at is
  'Set by trusted delivery infrastructure when a subscription becomes unusable.';


create index push_subscriptions_user_active_idx
on public.push_subscriptions (user_id)
where disabled_at is null;


revoke all
on table public.push_subscriptions
from public, anon, authenticated;

grant select, insert, update, delete
on table public.push_subscriptions
to service_role;


alter table public.push_subscriptions
enable row level security;

alter table public.push_subscriptions
force row level security;

-- Deliberately no authenticated RLS policies.
-- Browser mutation occurs only through controlled RPC boundaries.


create or replace function private.genesis_touch_push_subscription()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();

  return new;
end;
$function$;


revoke all
on function private.genesis_touch_push_subscription()
from public, anon, authenticated, service_role;


create trigger trg_genesis_touch_push_subscription
before update
on public.push_subscriptions
for each row
execute function private.genesis_touch_push_subscription();


create or replace function private.genesis_register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_expires_at timestamptz default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_endpoint text;
  v_p256dh text;
  v_auth_secret text;
  v_subscription_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AUTH_REQUIRED'
    );
  end if;


  if not exists (
    select 1
    from public.users_master as identity
    where identity.id = v_user_id
      and identity.account_status::text = 'ACTIVE'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ACCOUNT_NOT_ACTIVE'
    );
  end if;


  v_endpoint :=
    pg_catalog.btrim(
      pg_catalog.coalesce(p_endpoint, '')
    );

  v_p256dh :=
    pg_catalog.btrim(
      pg_catalog.coalesce(p_p256dh, '')
    );

  v_auth_secret :=
    pg_catalog.btrim(
      pg_catalog.coalesce(p_auth_secret, '')
    );


  if
    pg_catalog.char_length(v_endpoint) not between 16 and 4096
    or v_endpoint !~ '^https://[^[:space:]]+$'
  then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ENDPOINT_INVALID'
    );
  end if;


  if
    pg_catalog.char_length(v_p256dh) not between 16 and 512
    or v_p256dh !~ '^[A-Za-z0-9_-]+$'
  then
    return jsonb_build_object(
      'allowed', false,
      'code', 'P256DH_INVALID'
    );
  end if;


  if
    pg_catalog.char_length(v_auth_secret) not between 8 and 256
    or v_auth_secret !~ '^[A-Za-z0-9_-]+$'
  then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AUTH_SECRET_INVALID'
    );
  end if;


  if
    p_expires_at is not null
    and p_expires_at <= pg_catalog.now()
  then
    return jsonb_build_object(
      'allowed', false,
      'code', 'EXPIRATION_INVALID'
    );
  end if;



  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_secret,
    expires_at,
    user_agent,
    disabled_at,
    failure_count,
    last_failure_at,
    last_seen_at
  )
  values (
    v_user_id,
    v_endpoint,
    v_p256dh,
    v_auth_secret,
    p_expires_at,
    case
      when p_user_agent is null then null
      else pg_catalog.left(p_user_agent, 1024)
    end,
    null,
    0,
    null,
    pg_catalog.now()
  )
  on conflict (endpoint)
  do update
  set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret,
    expires_at = excluded.expires_at,
    user_agent = excluded.user_agent,
    disabled_at = null,
    failure_count = 0,
    last_failure_at = null,
    last_seen_at = pg_catalog.now()
  where
    public.push_subscriptions.user_id = v_user_id
    or (
      public.push_subscriptions.p256dh = v_p256dh
      and
      public.push_subscriptions.auth_secret = v_auth_secret
    )
  returning id
  into v_subscription_id;


  if v_subscription_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'SUBSCRIPTION_OWNERSHIP_CONFLICT'
    );
  end if;


  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'subscription_id', v_subscription_id
  );
end;
$function$;


revoke all
on function private.genesis_register_push_subscription(
  text,
  text,
  text,
  timestamptz,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function private.genesis_register_push_subscription(
  text,
  text,
  text,
  timestamptz,
  text
)
to authenticated;


create or replace function private.genesis_unregister_push_subscription(
  p_endpoint text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_endpoint text;
  v_removed_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AUTH_REQUIRED'
    );
  end if;


  v_endpoint :=
    pg_catalog.btrim(
      pg_catalog.coalesce(p_endpoint, '')
    );


  if
    pg_catalog.char_length(v_endpoint) not between 16 and 4096
    or v_endpoint !~ '^https://[^[:space:]]+$'
  then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ENDPOINT_INVALID'
    );
  end if;


  delete from public.push_subscriptions
  where user_id = v_user_id
    and endpoint = v_endpoint
  returning id
  into v_removed_id;


  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'removed', v_removed_id is not null
  );
end;
$function$;


revoke all
on function private.genesis_unregister_push_subscription(text)
from public, anon, authenticated, service_role;

grant execute
on function private.genesis_unregister_push_subscription(text)
to authenticated;


-- Public Data API facades.
-- These functions contain no privileged logic and run as the caller.

create or replace function public.genesis_register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_expires_at timestamptz default null,
  p_user_agent text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.genesis_register_push_subscription(
    p_endpoint,
    p_p256dh,
    p_auth_secret,
    p_expires_at,
    p_user_agent
  );
$function$;


revoke all
on function public.genesis_register_push_subscription(
  text,
  text,
  text,
  timestamptz,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function public.genesis_register_push_subscription(
  text,
  text,
  text,
  timestamptz,
  text
)
to authenticated;


create or replace function public.genesis_unregister_push_subscription(
  p_endpoint text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.genesis_unregister_push_subscription(
    p_endpoint
  );
$function$;


revoke all
on function public.genesis_unregister_push_subscription(text)
from public, anon, authenticated, service_role;

grant execute
on function public.genesis_unregister_push_subscription(text)
to authenticated;


-- The public invoker facades need namespace visibility in order
-- to invoke the explicitly granted private functions.
grant usage
on schema private
to authenticated;


do $postconditions$
declare
  v_rls_enabled boolean;
  v_rls_forced boolean;

  v_authenticated_table_access boolean;
  v_service_role_table_access boolean;

  v_policy_count integer;

  v_private_register_secure boolean;
  v_private_unregister_secure boolean;

  v_public_register_secure boolean;
  v_public_unregister_secure boolean;

  v_endpoint_unique boolean;
begin
  select
    relation.relrowsecurity,
    relation.relforcerowsecurity
  into
    v_rls_enabled,
    v_rls_forced
  from pg_catalog.pg_class as relation
  where relation.oid =
    'public.push_subscriptions'::regclass;


  v_authenticated_table_access :=
    has_table_privilege(
      'authenticated',
      'public.push_subscriptions',
      'SELECT'
    )
    or
    has_table_privilege(
      'authenticated',
      'public.push_subscriptions',
      'INSERT'
    )
    or
    has_table_privilege(
      'authenticated',
      'public.push_subscriptions',
      'UPDATE'
    )
    or
    has_table_privilege(
      'authenticated',
      'public.push_subscriptions',
      'DELETE'
    );


  v_service_role_table_access :=
    has_table_privilege(
      'service_role',
      'public.push_subscriptions',
      'SELECT'
    )
    and
    has_table_privilege(
      'service_role',
      'public.push_subscriptions',
      'INSERT'
    )
    and
    has_table_privilege(
      'service_role',
      'public.push_subscriptions',
      'UPDATE'
    )
    and
    has_table_privilege(
      'service_role',
      'public.push_subscriptions',
      'DELETE'
    );


  select pg_catalog.count(*)::integer
  into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'push_subscriptions';


  select
    procedure_row.prosecdef
    and
    has_function_privilege(
      'authenticated',
      procedure_row.oid,
      'EXECUTE'
    )
    and not
    has_function_privilege(
      'anon',
      procedure_row.oid,
      'EXECUTE'
    )
  into v_private_register_secure
  from pg_catalog.pg_proc as procedure_row
  where procedure_row.oid =
    to_regprocedure(
      'private.genesis_register_push_subscription(text,text,text,timestamptz,text)'
    );


  select
    procedure_row.prosecdef
    and
    has_function_privilege(
      'authenticated',
      procedure_row.oid,
      'EXECUTE'
    )
    and not
    has_function_privilege(
      'anon',
      procedure_row.oid,
      'EXECUTE'
    )
  into v_private_unregister_secure
  from pg_catalog.pg_proc as procedure_row
  where procedure_row.oid =
    to_regprocedure(
      'private.genesis_unregister_push_subscription(text)'
    );


  select
    not procedure_row.prosecdef
    and
    has_function_privilege(
      'authenticated',
      procedure_row.oid,
      'EXECUTE'
    )
    and not
    has_function_privilege(
      'anon',
      procedure_row.oid,
      'EXECUTE'
    )
  into v_public_register_secure
  from pg_catalog.pg_proc as procedure_row
  where procedure_row.oid =
    to_regprocedure(
      'public.genesis_register_push_subscription(text,text,text,timestamptz,text)'
    );


  select
    not procedure_row.prosecdef
    and
    has_function_privilege(
      'authenticated',
      procedure_row.oid,
      'EXECUTE'
    )
    and not
    has_function_privilege(
      'anon',
      procedure_row.oid,
      'EXECUTE'
    )
  into v_public_unregister_secure
  from pg_catalog.pg_proc as procedure_row
  where procedure_row.oid =
    to_regprocedure(
      'public.genesis_unregister_push_subscription(text)'
    );


  select exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid =
      'public.push_subscriptions'::regclass
      and constraint_row.conname =
        'push_subscriptions_endpoint_unique'
  )
  into v_endpoint_unique;


  if
    not coalesce(v_rls_enabled, false)
    or not coalesce(v_rls_forced, false)
    or coalesce(v_authenticated_table_access, true)
    or not coalesce(v_service_role_table_access, false)
    or coalesce(v_policy_count, -1) <> 0
    or not coalesce(v_private_register_secure, false)
    or not coalesce(v_private_unregister_secure, false)
    or not coalesce(v_public_register_secure, false)
    or not coalesce(v_public_unregister_secure, false)
    or not coalesce(v_endpoint_unique, false)
  then
    raise exception
      'GENESIS_PUSH_SUBSCRIPTION_AUTHORITY_VERIFY_FAILED';
  end if;
end;
$postconditions$;