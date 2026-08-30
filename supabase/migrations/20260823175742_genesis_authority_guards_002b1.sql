-- GENESIS OS — MIGRATION 002B1
-- Authority guards + immersive profile foundation + supporting indexes

create schema if not exists private;

-- ------------------------------------------------------------
-- PRIVATE AUTH HELPERS
-- ------------------------------------------------------------

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select um.role::text
  from public.users_master um
  where um.id = auth.uid()
  limit 1;
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    exists (
      select 1
      from public.users_master um
      where um.id = auth.uid()
        and um.role::text = 'SUPER_ADMIN'
        and um.account_status::text = 'ACTIVE'
    ),
    false
  );
$$;

create or replace function private.current_coach_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cp.id
  from public.coaches_profile cp
  where cp.user_id = auth.uid()
  limit 1;
$$;

create or replace function private.is_assigned_coach(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    exists (
      select 1
      from public.athletes_profile ap
      join public.coaches_profile cp
        on cp.id = ap.coach_id
      where ap.id = p_athlete_id
        and cp.user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function private.coach_can_assign_athlete_plan(p_plan text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_coach_plan text;
begin
  v_role := private.current_user_role();

  if v_role = 'SUPER_ADMIN' then
    return p_plan in ('IGNICION', 'EVOLUCION', 'ELITE');
  end if;

  if v_role <> 'COACH' then
    return false;
  end if;

  select cp.b2b_plan
    into v_coach_plan
  from public.coaches_profile cp
  where cp.user_id = auth.uid()
  limit 1;

  if v_coach_plan = 'IGNICION' then
    return p_plan in ('IGNICION', 'EVOLUCION');
  elsif v_coach_plan in ('EVOLUCION', 'ELITE') then
    return p_plan in ('IGNICION', 'EVOLUCION', 'ELITE');
  end if;

  return false;
end;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;

revoke all on function private.current_user_role() from public;
revoke all on function private.is_super_admin() from public;
revoke all on function private.current_coach_profile_id() from public;
revoke all on function private.is_assigned_coach(uuid) from public;
revoke all on function private.coach_can_assign_athlete_plan(text) from public;

grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.current_coach_profile_id() to authenticated;
grant execute on function private.is_assigned_coach(uuid) to authenticated;
grant execute on function private.coach_can_assign_athlete_plan(text) to authenticated;

-- ------------------------------------------------------------
-- COACH PROFILE AUTHORITY GUARD
-- Prevents a coach from self-upgrading or rewriting invite authority.
-- ------------------------------------------------------------

create or replace function private.guard_coach_profile_authority()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  -- Calls made from trusted SECURITY DEFINER/server contexts.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if private.is_super_admin() then
    return new;
  end if;

  if auth.uid() is null or old.user_id is distinct from auth.uid() then
    raise exception 'GENESIS_AUTH: coach profile update not authorized';
  end if;

  if new.user_id is distinct from old.user_id
     or new.b2b_plan is distinct from old.b2b_plan
     or new.subscription_tier is distinct from old.subscription_tier
     or new.coach_code is distinct from old.coach_code
     or new.invite_code_ignicion is distinct from old.invite_code_ignicion
     or new.invite_code_evolucion is distinct from old.invite_code_evolucion
     or new.invite_code_elite is distinct from old.invite_code_elite
     or new.max_clients_limit is distinct from old.max_clients_limit
     or new.active_clients_count is distinct from old.active_clients_count
     or new.referred_by_coach_id is distinct from old.referred_by_coach_id
  then
    raise exception 'GENESIS_AUTH: protected coach authority field';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_coach_profile_authority on public.coaches_profile;
create trigger trg_guard_coach_profile_authority
before update on public.coaches_profile
for each row
execute function private.guard_coach_profile_authority();

-- ------------------------------------------------------------
-- ATHLETE PROFILE AUTHORITY GUARD
-- Allows legitimate app writes while protecting ownership/plan/status authority.
-- ------------------------------------------------------------

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
begin
  -- Trusted server/RPC contexts may perform controlled authority writes.
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
    -- Ownership/contract fields are never delegated to a coach.
    if new.user_id is distinct from old.user_id
       or new.coach_id is distinct from old.coach_id
       or new.is_onboarded is distinct from old.is_onboarded
       or new.legal_accepted is distinct from old.legal_accepted
    then
      raise exception 'GENESIS_AUTH: protected athlete ownership field';
    end if;

    if new.b2c_plan is distinct from old.b2c_plan
       and not private.coach_can_assign_athlete_plan(new.b2c_plan)
    then
      raise exception 'GENESIS_AUTH: coach plan cannot assign requested athlete plan';
    end if;

    return new;
  end if;

  if v_is_self then
    -- Athlete cannot rewrite commercial/ownership/system authority.
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

    -- Athlete may submit/re-submit for audit, but cannot self-approve.
    if new.routine_status is distinct from old.routine_status
       and new.routine_status <> 'PENDING_AUDIT'
    then
      raise exception 'GENESIS_AUTH: athlete cannot set this routine status';
    end if;

    -- Hormonal writes only for eligible Elite female profiles.
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

drop trigger if exists trg_guard_athlete_profile_authority on public.athletes_profile;
create trigger trg_guard_athlete_profile_authority
before update on public.athletes_profile
for each row
execute function private.guard_athlete_profile_authority();

-- ------------------------------------------------------------
-- IMMERSIVE ATHLETE PROFILE
-- Internal definer + public invoker wrapper.
-- ------------------------------------------------------------

create or replace function private.ensure_immersive_athlete_profile_internal()
returns table (
  athlete_id uuid,
  athlete_plan text,
  created boolean
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_coach_id uuid;
  v_coach_plan text;
  v_name text;
  v_existing_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select um.role::text, um.account_status::text, um.full_name
    into v_role, v_status, v_name
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_status <> 'ACTIVE' then
    raise exception 'Active Genesis account required';
  end if;

  if v_role = 'COACH' then
    select cp.id, cp.b2b_plan, coalesce(cp.full_name, v_name)
      into v_coach_id, v_coach_plan, v_name
    from public.coaches_profile cp
    where cp.user_id = v_uid
    limit 1;

    if v_coach_id is null or v_coach_plan <> 'ELITE' then
      raise exception 'Coach Elite required for immersive athlete mode';
    end if;
  elsif v_role = 'SUPER_ADMIN' then
    select cp.id, coalesce(cp.full_name, v_name)
      into v_coach_id, v_name
    from public.coaches_profile cp
    where cp.user_id = v_uid
    limit 1;
  else
    raise exception 'Role not eligible for immersive athlete mode';
  end if;

  select ap.id
    into v_existing_id
  from public.athletes_profile ap
  where ap.user_id = v_uid
  limit 1;

  if v_existing_id is not null then
    update public.athletes_profile
       set b2c_plan = 'ELITE',
           is_onboarded = true
     where id = v_existing_id;

    return query
    select v_existing_id, 'ELITE'::text, false;
    return;
  end if;

  insert into public.athletes_profile (
    user_id,
    coach_id,
    full_name,
    b2c_plan,
    is_onboarded,
    goal,
    program_start_date
  ) values (
    v_uid,
    v_coach_id,
    coalesce(v_name, 'Genesis Immersive Athlete'),
    'ELITE',
    true,
    'Modo Inmersivo',
    now()
  )
  returning id into v_existing_id;

  return query
  select v_existing_id, 'ELITE'::text, true;
end;
$$;

revoke all on function private.ensure_immersive_athlete_profile_internal() from public;
grant execute on function private.ensure_immersive_athlete_profile_internal() to authenticated;

create or replace function public.ensure_immersive_athlete_profile()
returns table (
  athlete_id uuid,
  athlete_plan text,
  created boolean
)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select *
  from private.ensure_immersive_athlete_profile_internal();
$$;

revoke all on function public.ensure_immersive_athlete_profile() from public;
revoke all on function public.ensure_immersive_athlete_profile() from anon;
grant execute on function public.ensure_immersive_athlete_profile() to authenticated;

-- ------------------------------------------------------------
-- SUPPORTING INDEXES REPORTED BY ADVISOR
-- ------------------------------------------------------------

create index if not exists audit_logs_user_id_idx
  on public.audit_logs(user_id);

create index if not exists coaches_profile_referred_by_coach_id_idx
  on public.coaches_profile(referred_by_coach_id);

create index if not exists community_messages_sender_id_idx
  on public.community_messages(sender_id);

create index if not exists daily_logs_user_id_idx
  on public.daily_logs(user_id);

create index if not exists global_announcements_created_by_idx
  on public.global_announcements(created_by);

create index if not exists profiles_coach_id_idx
  on public.profiles(coach_id);
;
