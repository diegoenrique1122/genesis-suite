-- GENESIS OS — 002B6.C.1.B
-- Close direct client-side deletion paths for account-root profiles.
-- Account deletion is performed only by genesis-account-lifecycle using service_role.

begin;

alter table public.coaches_profile enable row level security;
alter table public.athletes_profile enable row level security;

drop policy if exists coaches_profile_delete_super_admin
  on public.coaches_profile;

drop policy if exists athletes_profile_delete_super_admin
  on public.athletes_profile;

revoke delete on table public.coaches_profile
  from anon, authenticated;

revoke delete on table public.athletes_profile
  from anon, authenticated;

do $assert$
begin
  if has_table_privilege(
    'authenticated',
    'public.coaches_profile',
    'DELETE'
  ) then
    raise exception
      'GENESIS_C1B_COACHES_PROFILE_DELETE_GRANT_REMAINS';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.athletes_profile',
    'DELETE'
  ) then
    raise exception
      'GENESIS_C1B_ATHLETES_PROFILE_DELETE_GRANT_REMAINS';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('coaches_profile', 'athletes_profile')
      and cmd = 'DELETE'
  ) then
    raise exception
      'GENESIS_C1B_ROOT_DELETE_POLICY_REMAINS';
  end if;
end;
$assert$;

commit;
