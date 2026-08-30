create schema if not exists private;

create or replace function private.handle_genesis_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_type text;
  v_full_name text;
begin
  v_registration_type := upper(coalesce(new.raw_user_meta_data ->> 'genesis_registration_type', ''));
  v_full_name := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '');

  -- Only the two public Genesis registration flows are provisioned.
  -- Any forged value such as SUPER_ADMIN creates no application identity.
  if v_registration_type not in ('ATHLETE', 'COACH') then
    return new;
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
$$;

revoke all on function private.handle_genesis_auth_signup() from public;
revoke all on function private.handle_genesis_auth_signup() from anon;
revoke all on function private.handle_genesis_auth_signup() from authenticated;

-- The trigger is inert for existing clients unless signup metadata explicitly
-- includes genesis_registration_type=ATHLETE or COACH.
drop trigger if exists on_genesis_auth_user_created on auth.users;
create trigger on_genesis_auth_user_created
after insert on auth.users
for each row
execute function private.handle_genesis_auth_signup();;
