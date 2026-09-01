-- GENESIS OS — 002B6.C.5
-- Transactional containment for the account lifecycle rollout.
--
-- This migration is intentionally compatible with the current production UI:
--   * users_master SELECT/UPDATE remain available to authenticated users under RLS;
--   * super_admin_settings keeps SELECT/INSERT/UPDATE for the existing upsert;
--   * athlete_photos keeps SELECT/INSERT/UPDATE for metadata upserts;
--   * direct client-side hard delete is removed;
--   * audit evidence survives Auth user deletion.

-- -----------------------------------------------------------------------------
-- 1. Contain the legacy client-side hard-delete path.
-- -----------------------------------------------------------------------------

alter table public.users_master enable row level security;

drop policy if exists users_master_delete_super_admin
  on public.users_master;

revoke delete on table public.users_master
  from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Preserve audit evidence when an Auth identity is hard-deleted.
-- -----------------------------------------------------------------------------

alter table public.audit_logs enable row level security;

alter table public.audit_logs
  drop constraint audit_logs_user_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;

drop policy if exists "Acceso total audit_logs"
  on public.audit_logs;

revoke all privileges on table public.audit_logs
  from anon, authenticated;

grant select on table public.audit_logs
  to authenticated;

create policy audit_logs_select_super_admin
  on public.audit_logs
  for select
  to authenticated
  using (private.is_super_admin());

-- -----------------------------------------------------------------------------
-- 3. Protect the singleton SuperAdmin settings row while preserving upsert.
-- -----------------------------------------------------------------------------

alter table public.super_admin_settings enable row level security;

drop policy if exists "Acceso super_admin_settings"
  on public.super_admin_settings;

revoke all privileges on table public.super_admin_settings
  from anon, authenticated;

grant select, insert, update on table public.super_admin_settings
  to authenticated;

create policy super_admin_settings_select_authenticated
  on public.super_admin_settings
  for select
  to authenticated
  using (true);

create policy super_admin_settings_insert_super_admin
  on public.super_admin_settings
  for insert
  to authenticated
  with check (
    private.is_super_admin()
    and id = 1
  );

create policy super_admin_settings_update_super_admin
  on public.super_admin_settings
  for update
  to authenticated
  using (
    private.is_super_admin()
    and id = 1
  )
  with check (
    private.is_super_admin()
    and id = 1
  );

-- -----------------------------------------------------------------------------
-- 4. Canonical authority for athlete photo metadata.
-- -----------------------------------------------------------------------------

create or replace function private.can_manage_athlete_photo(
  p_athlete_id uuid,
  p_coach_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    exists (
      select 1
      from public.athletes_profile ap
      left join public.coaches_profile cp
        on cp.id = ap.coach_id
      join public.users_master caller
        on caller.id = auth.uid()
       and caller.account_status::text = 'ACTIVE'
      where ap.id = p_athlete_id
        and ap.coach_id is not distinct from p_coach_id
        and (
          caller.role::text = 'SUPER_ADMIN'
          or ap.user_id = auth.uid()
          or cp.user_id = auth.uid()
        )
    ),
    false
  );
$function$;

revoke all on function private.can_manage_athlete_photo(uuid, uuid)
  from public, anon;

grant execute on function private.can_manage_athlete_photo(uuid, uuid)
  to authenticated;

alter table public.athlete_photos enable row level security;

drop policy if exists "Acceso total athlete_photos"
  on public.athlete_photos;

revoke all privileges on table public.athlete_photos
  from anon, authenticated;

-- SELECT + INSERT + UPDATE are all required by the current metadata upsert.
grant select, insert, update on table public.athlete_photos
  to authenticated;

create policy athlete_photos_select_authorized
  on public.athlete_photos
  for select
  to authenticated
  using (
    private.can_manage_athlete_photo(athlete_id, coach_id)
  );

create policy athlete_photos_insert_authorized
  on public.athlete_photos
  for insert
  to authenticated
  with check (
    private.can_manage_athlete_photo(athlete_id, coach_id)
  );

create policy athlete_photos_update_authorized
  on public.athlete_photos
  for update
  to authenticated
  using (
    private.can_manage_athlete_photo(athlete_id, coach_id)
  )
  with check (
    private.can_manage_athlete_photo(athlete_id, coach_id)
  );

-- -----------------------------------------------------------------------------
-- 5. Fail-closed structural assertions.
-- -----------------------------------------------------------------------------

do $assertions$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users_master'
      and cmd in ('DELETE', 'ALL')
  ) then
    raise exception 'GENESIS_C5_FAIL: users_master DELETE policy remains';
  end if;

  if has_table_privilege('authenticated', 'public.users_master', 'DELETE')
     or has_table_privilege('anon', 'public.users_master', 'DELETE') then
    raise exception 'GENESIS_C5_FAIL: users_master DELETE grant remains';
  end if;

  if not has_table_privilege('authenticated', 'public.users_master', 'SELECT')
     or not has_table_privilege('authenticated', 'public.users_master', 'UPDATE') then
    raise exception 'GENESIS_C5_FAIL: users_master compatibility grants lost';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.audit_logs'::regclass
      and conname = 'audit_logs_user_id_fkey'
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'n'
  ) then
    raise exception 'GENESIS_C5_FAIL: audit_logs FK is not ON DELETE SET NULL';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
  ) <> 1
  or not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'audit_logs_select_super_admin'
      and cmd = 'SELECT'
  ) then
    raise exception 'GENESIS_C5_FAIL: audit_logs policy set mismatch';
  end if;

  if not has_table_privilege('authenticated', 'public.audit_logs', 'SELECT')
     or has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')
     or has_table_privilege('anon', 'public.audit_logs', 'SELECT')
     or has_table_privilege('anon', 'public.audit_logs', 'INSERT')
     or has_table_privilege('anon', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('anon', 'public.audit_logs', 'DELETE') then
    raise exception 'GENESIS_C5_FAIL: audit_logs grants mismatch';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'super_admin_settings'
  ) <> 3
  or (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'super_admin_settings'
      and policyname in (
        'super_admin_settings_select_authenticated',
        'super_admin_settings_insert_super_admin',
        'super_admin_settings_update_super_admin'
      )
  ) <> 3
  or exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'super_admin_settings'
      and cmd in ('DELETE', 'ALL')
  ) then
    raise exception 'GENESIS_C5_FAIL: super_admin_settings policy set mismatch';
  end if;

  if not has_table_privilege('authenticated', 'public.super_admin_settings', 'SELECT')
     or not has_table_privilege('authenticated', 'public.super_admin_settings', 'INSERT')
     or not has_table_privilege('authenticated', 'public.super_admin_settings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.super_admin_settings', 'DELETE')
     or has_table_privilege('anon', 'public.super_admin_settings', 'SELECT')
     or has_table_privilege('anon', 'public.super_admin_settings', 'INSERT')
     or has_table_privilege('anon', 'public.super_admin_settings', 'UPDATE')
     or has_table_privilege('anon', 'public.super_admin_settings', 'DELETE') then
    raise exception 'GENESIS_C5_FAIL: super_admin_settings grants mismatch';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_photos'
  ) <> 3
  or (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_photos'
      and policyname in (
        'athlete_photos_select_authorized',
        'athlete_photos_insert_authorized',
        'athlete_photos_update_authorized'
      )
  ) <> 3
  or exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_photos'
      and cmd in ('DELETE', 'ALL')
  ) then
    raise exception 'GENESIS_C5_FAIL: athlete_photos policy set mismatch';
  end if;

  if not has_table_privilege('authenticated', 'public.athlete_photos', 'SELECT')
     or not has_table_privilege('authenticated', 'public.athlete_photos', 'INSERT')
     or not has_table_privilege('authenticated', 'public.athlete_photos', 'UPDATE')
     or has_table_privilege('authenticated', 'public.athlete_photos', 'DELETE')
     or has_table_privilege('anon', 'public.athlete_photos', 'SELECT')
     or has_table_privilege('anon', 'public.athlete_photos', 'INSERT')
     or has_table_privilege('anon', 'public.athlete_photos', 'UPDATE')
     or has_table_privilege('anon', 'public.athlete_photos', 'DELETE') then
    raise exception 'GENESIS_C5_FAIL: athlete_photos grants mismatch';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'can_manage_athlete_photo'
      and pg_get_function_identity_arguments(p.oid) =
        'p_athlete_id uuid, p_coach_id uuid'
      and p.prosecdef
      and 'search_path=""' = any(p.proconfig)
  ) then
    raise exception 'GENESIS_C5_FAIL: photo authority helper hardening mismatch';
  end if;

  if has_function_privilege(
       'public',
       'private.can_manage_athlete_photo(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'private.can_manage_athlete_photo(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'private.can_manage_athlete_photo(uuid,uuid)',
       'EXECUTE'
     ) then
    raise exception 'GENESIS_C5_FAIL: photo authority helper grants mismatch';
  end if;

  if not has_table_privilege('service_role', 'public.audit_logs', 'INSERT')
     or not has_table_privilege('service_role', 'public.athlete_photos', 'DELETE')
     or not has_table_privilege('service_role', 'public.super_admin_settings', 'UPDATE') then
    raise exception 'GENESIS_C5_FAIL: service_role compatibility lost';
  end if;
end
$assertions$;
