-- GENESIS OS — 002B6.C.1.C
-- Enforce the public Auth signup contract before an Auth identity is retained.
-- Valid public registration types are ATHLETE and COACH only.

begin;

create or replace function private.handle_genesis_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_registration_type text;
  v_full_name text;
begin
  v_registration_type := upper(
    coalesce(new.raw_user_meta_data ->> 'genesis_registration_type', '')
  );
  v_full_name := nullif(
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120),
    ''
  );

  -- Reject invalid or missing registration metadata atomically. Returning NEW
  -- here would retain an Auth identity without an application identity.
  if v_registration_type not in ('ATHLETE', 'COACH') then
    raise exception using
      errcode = '22023',
      message = 'GENESIS_REGISTRATION_TYPE_REQUIRED';
  end if;

  insert into public.users_master (
    id,
    email,
    full_name,
    role,
    account_status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    v_registration_type::public.user_role,
    case
      when v_registration_type = 'COACH' then 'PENDING'::public.account_status
      else 'ACTIVE'::public.account_status
    end
  );

  if v_registration_type = 'COACH' then
    insert into public.coaches_profile (
      user_id,
      full_name,
      b2b_plan,
      subscription_tier
    )
    values (
      new.id,
      v_full_name,
      'IGNICION',
      'IGNICION'::public.b2b_tier
    );
  else
    insert into public.athletes_profile (
      user_id,
      is_onboarded
    )
    values (
      new.id,
      false
    );
  end if;

  return new;
end;
$function$;

do $assert$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.handle_genesis_auth_signup()'::regprocedure)
    into v_definition;

  if position('GENESIS_REGISTRATION_TYPE_REQUIRED' in v_definition) = 0 then
    raise exception 'GENESIS_C1C_REGISTRATION_CONTRACT_ASSERTION_FAILED';
  end if;
end;
$assert$;

commit;
