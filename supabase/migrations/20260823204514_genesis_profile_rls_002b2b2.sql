-- Genesis OS 002B2B.2
-- Replace permissive coaches_profile / athletes_profile RLS with relationship-aware policies.

create or replace function private.can_read_coach_profile(p_coach_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  if private.is_super_admin() then
    return true;
  end if;

  if exists (
    select 1
    from public.coaches_profile cp
    where cp.id = p_coach_profile_id
      and cp.user_id = v_uid
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.athletes_profile ap
    where ap.user_id = v_uid
      and ap.coach_id = p_coach_profile_id
  );
end;
$$;

revoke all on function private.can_read_coach_profile(uuid) from public, anon;
grant execute on function private.can_read_coach_profile(uuid) to authenticated;

create or replace function private.can_read_athlete_profile(p_athlete_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  if private.is_super_admin() then
    return true;
  end if;

  if exists (
    select 1
    from public.athletes_profile ap
    where ap.id = p_athlete_profile_id
      and ap.user_id = v_uid
  ) then
    return true;
  end if;

  return private.is_assigned_coach(p_athlete_profile_id);
end;
$$;

revoke all on function private.can_read_athlete_profile(uuid) from public, anon;
grant execute on function private.can_read_athlete_profile(uuid) to authenticated;

drop policy if exists "Acceso total coaches_profile" on public.coaches_profile;
drop policy if exists "Acceso total para coaches" on public.coaches_profile;
drop policy if exists "Atletas_Validan_Codigos" on public.coaches_profile;
drop policy if exists "Coaches actualizan su perfil" on public.coaches_profile;
drop policy if exists "Coaches leen su perfil" on public.coaches_profile;
drop policy if exists "Permitir insert propio en coaches_profile" on public.coaches_profile;
drop policy if exists "Super_Admin_Lee_Perfiles_Coaches" on public.coaches_profile;

create policy coaches_profile_select_authorized
on public.coaches_profile
for select
to authenticated
using (private.can_read_coach_profile(id));

create policy coaches_profile_update_authorized
on public.coaches_profile
for update
to authenticated
using (
  private.is_super_admin()
  or user_id = (select auth.uid())
)
with check (
  private.is_super_admin()
  or user_id = (select auth.uid())
);

create policy coaches_profile_insert_super_admin
on public.coaches_profile
for insert
to authenticated
with check (private.is_super_admin());

create policy coaches_profile_delete_super_admin
on public.coaches_profile
for delete
to authenticated
using (private.is_super_admin());

revoke all on table public.coaches_profile from anon, authenticated;
grant select, insert, update, delete on table public.coaches_profile to authenticated;

drop policy if exists "Acceso total athletes_profile" on public.athletes_profile;
drop policy if exists "Atletas leen su perfil" on public.athletes_profile;
drop policy if exists "Coaches_Actualizan_Sus_Atletas" on public.athletes_profile;
drop policy if exists "Coaches_Sus_Atletas" on public.athletes_profile;
drop policy if exists "Permitir insert propio en athletes_profile" on public.athletes_profile;
drop policy if exists "Permitir update propio en athletes_profile" on public.athletes_profile;

create policy athletes_profile_select_authorized
on public.athletes_profile
for select
to authenticated
using (private.can_read_athlete_profile(id));

create policy athletes_profile_update_authorized
on public.athletes_profile
for update
to authenticated
using (
  private.is_super_admin()
  or user_id = (select auth.uid())
  or private.is_assigned_coach(id)
)
with check (
  private.is_super_admin()
  or user_id = (select auth.uid())
  or private.is_assigned_coach(id)
);

create policy athletes_profile_delete_super_admin
on public.athletes_profile
for delete
to authenticated
using (private.is_super_admin());

revoke all on table public.athletes_profile from anon, authenticated;
grant select, update, delete on table public.athletes_profile to authenticated;
