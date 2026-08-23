-- Genesis OS 002B2B.1
-- Tighten coach authority on athlete profiles and replace permissive users_master RLS.

create or replace function private.current_coach_b2b_plan()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cp.b2b_plan
  from public.coaches_profile cp
  where cp.user_id = auth.uid()
  limit 1;
$$;

revoke all on function private.current_coach_b2b_plan() from public, anon;
grant execute on function private.current_coach_b2b_plan() to authenticated;

create or replace function private.can_read_user_master(p_target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_coach_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  if p_target_user_id = v_uid then
    return true;
  end if;

  if private.is_super_admin() then
    return true;
  end if;

  select um.role::text
    into v_role
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_role = 'COACH' then
    if exists (
      select 1
      from public.users_master target
      where target.id = p_target_user_id
        and target.role::text = 'SUPER_ADMIN'
        and target.account_status::text = 'ACTIVE'
    ) then
      return true;
    end if;

    select cp.id
      into v_coach_id
    from public.coaches_profile cp
    where cp.user_id = v_uid
    limit 1;

    if v_coach_id is null then
      return false;
    end if;

    return exists (
      select 1
      from public.athletes_profile ap
      where ap.user_id = p_target_user_id
        and ap.coach_id = v_coach_id
    );
  end if;

  if v_role = 'ATHLETE' then
    return exists (
      select 1
      from public.athletes_profile ap
      join public.coaches_profile cp
        on cp.id = ap.coach_id
      where ap.user_id = v_uid
        and cp.user_id = p_target_user_id
    );
  end if;

  return false;
end;
$$;

revoke all on function private.can_read_user_master(uuid) from public, anon;
grant execute on function private.can_read_user_master(uuid) to authenticated;

create or replace function private.guard_athlete_profile_authority()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_is_coach boolean;
  v_is_self boolean;
  v_gender text;
  v_coach_plan text;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if private.is_super_admin() then
    return new;
  end if;

  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'GENESIS_AUTH: unauthenticated athlete update';
  end if;

  v_is_self := old.user_id = v_uid;
  v_is_coach := private.is_assigned_coach(old.id);

  if v_is_coach then
    v_coach_plan := private.current_coach_b2b_plan();

    if v_coach_plan not in ('IGNICION', 'EVOLUCION', 'ELITE') then
      raise exception 'GENESIS_AUTH: coach plan is not authorized';
    end if;

    if new.user_id is distinct from old.user_id
       or new.coach_id is distinct from old.coach_id
       or new.is_onboarded is distinct from old.is_onboarded
       or new.legal_accepted is distinct from old.legal_accepted
       or new.program_start_date is distinct from old.program_start_date
       or new.ai_diagnosis is distinct from old.ai_diagnosis
       or new.hormonal_data is distinct from old.hormonal_data
       or new.discipline_metrics is distinct from old.discipline_metrics
       or new.wearable_data is distinct from old.wearable_data
       or new.earned_badges is distinct from old.earned_badges
       or new.selected_app_single is distinct from old.selected_app_single
    then
      raise exception 'GENESIS_AUTH: protected athlete system field';
    end if;

    if new.b2c_plan is distinct from old.b2c_plan
       and not private.coach_can_assign_athlete_plan(new.b2c_plan)
    then
      raise exception 'GENESIS_AUTH: coach plan cannot assign requested athlete plan';
    end if;

    if v_coach_plan = 'IGNICION'
       and (
         new.training_plan is distinct from old.training_plan
         or new.routine_status is distinct from old.routine_status
         or new.coach_note is distinct from old.coach_note
         or new.nutrition_plan is distinct from old.nutrition_plan
         or new.diet_status is distinct from old.diet_status
         or new.custom_macros is distinct from old.custom_macros
         or new.food_preferences is distinct from old.food_preferences
         or new.coach_customizations is distinct from old.coach_customizations
       )
    then
      raise exception 'GENESIS_AUTH: B2B IGNICION cannot override athlete training or nutrition';
    end if;

    return new;
  end if;

  if v_is_self then
    if new.user_id is distinct from old.user_id
       or new.coach_id is distinct from old.coach_id
       or new.b2c_plan is distinct from old.b2c_plan
       or new.is_onboarded is distinct from old.is_onboarded
       or new.legal_accepted is distinct from old.legal_accepted
       or new.program_start_date is distinct from old.program_start_date
       or new.ai_diagnosis is distinct from old.ai_diagnosis
       or new.coach_note is distinct from old.coach_note
       or new.coach_customizations is distinct from old.coach_customizations
       or new.earned_badges is distinct from old.earned_badges
    then
      raise exception 'GENESIS_AUTH: protected athlete authority field';
    end if;

    if new.routine_status is distinct from old.routine_status
       and new.routine_status <> 'PENDING_AUDIT'
    then
      raise exception 'GENESIS_AUTH: athlete cannot set this routine status';
    end if;

    if new.hormonal_data is distinct from old.hormonal_data then
      v_gender := upper(trim(coalesce(old.gender, '')));

      if old.b2c_plan <> 'ELITE'
         or v_gender not in ('FEMALE', 'FEMENINO', 'MUJER')
      then
        raise exception 'GENESIS_AUTH: hormonal data not eligible for this profile';
      end if;
    end if;

    return new;
  end if;

  raise exception 'GENESIS_AUTH: athlete profile update not authorized';
end;
$$;

drop policy if exists "Acceso total users_master" on public.users_master;
drop policy if exists "Atletas_Leen_Estado_Coach" on public.users_master;
drop policy if exists "Coaches_Actualizan_Estado_Atletas" on public.users_master;
drop policy if exists "Coaches_Leen_Estado_Atletas" on public.users_master;
drop policy if exists "Permitir insert propio en users_master" on public.users_master;
drop policy if exists "Permitir lectura users_master" on public.users_master;
drop policy if exists "Permitir update propio en users_master" on public.users_master;
drop policy if exists "Super_Admin_Lee_Todo" on public.users_master;
drop policy if exists "Usuarios leen su propia data" on public.users_master;

create policy users_master_select_authorized
on public.users_master
for select
to authenticated
using (private.can_read_user_master(id));

create policy users_master_update_super_admin
on public.users_master
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy users_master_delete_super_admin
on public.users_master
for delete
to authenticated
using (private.is_super_admin());

revoke all on table public.users_master from anon, authenticated;
grant select, update, delete on table public.users_master to authenticated;
