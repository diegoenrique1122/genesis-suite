-- =====================================================
-- GENESIS C3B14.2C.2D.1
-- Push subscription RPC COALESCE correction
--
-- Scope:
--   - private.genesis_register_push_subscription
--   - private.genesis_unregister_push_subscription
--
-- Root cause:
--   COALESCE is SQL syntax, not pg_catalog.coalesce().
--
-- Public Data API facades and table authority remain
-- unchanged.
-- =====================================================

begin;


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
      coalesce(
        p_endpoint,
        ''::text
      )
    );

  v_p256dh :=
    pg_catalog.btrim(
      coalesce(
        p_p256dh,
        ''::text
      )
    );

  v_auth_secret :=
    pg_catalog.btrim(
      coalesce(
        p_auth_secret,
        ''::text
      )
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
      else pg_catalog.left(
        p_user_agent,
        1024
      )
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
      coalesce(
        p_endpoint,
        ''::text
      )
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
on function private.genesis_unregister_push_subscription(
  text
)
from public, anon, authenticated, service_role;

grant execute
on function private.genesis_unregister_push_subscription(
  text
)
to authenticated;


-- =====================================================
-- POSTCONDITIONS
-- =====================================================

do $verify$
declare
  v_register oid;
  v_unregister oid;
  v_register_definition text;
  v_unregister_definition text;
begin
  v_register :=
    to_regprocedure(
      'private.genesis_register_push_subscription(text,text,text,timestamptz,text)'
    );

  v_unregister :=
    to_regprocedure(
      'private.genesis_unregister_push_subscription(text)'
    );


  if v_register is null then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: register missing';
  end if;

  if v_unregister is null then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: unregister missing';
  end if;


  select pg_get_functiondef(v_register)
  into v_register_definition;

  select pg_get_functiondef(v_unregister)
  into v_unregister_definition;


  if
    v_register_definition ilike '%pg_catalog.coalesce%'
  then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: register still broken';
  end if;


  if
    v_unregister_definition ilike '%pg_catalog.coalesce%'
  then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: unregister still broken';
  end if;


  if not exists (
    select 1
    from pg_proc as p
    where p.oid = v_register
      and p.prosecdef is true
  ) then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: register not security definer';
  end if;


  if not exists (
    select 1
    from pg_proc as p
    where p.oid = v_unregister
      and p.prosecdef is true
  ) then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: unregister not security definer';
  end if;


  if not has_function_privilege(
    'authenticated',
    v_register,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: authenticated register execute missing';
  end if;


  if has_function_privilege(
    'anon',
    v_register,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: anon register execute present';
  end if;


  if not has_function_privilege(
    'authenticated',
    v_unregister,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: authenticated unregister execute missing';
  end if;


  if has_function_privilege(
    'anon',
    v_unregister,
    'EXECUTE'
  ) then
    raise exception
      'GENESIS_PUSH_COALESCE_FIX_VERIFY_FAIL: anon unregister execute present';
  end if;
end;
$verify$;


notify pgrst, 'reload schema';


commit;