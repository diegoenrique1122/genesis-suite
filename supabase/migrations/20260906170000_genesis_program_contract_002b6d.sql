-- GENESIS C3B14
-- Contrato comercial del programa del atleta.
--
-- El código de invitación continúa asignando coach + plan base durante
-- el onboarding. La duración y la activación pertenecen a este contrato
-- y solo pueden ser decididas por el coach asignado o SUPER_ADMIN.

create table if not exists public.athlete_programs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null
    references public.athletes_profile(id)
    on delete cascade,
  coach_id uuid
    references public.coaches_profile(id)
    on delete set null,
  package_tier text not null,
  service_focus text not null default 'PENDING',
  duration_value integer,
  duration_unit text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'PENDING_ACTIVATION',
  created_by uuid
    references public.users_master(id)
    on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint athlete_programs_package_tier_chk
    check (package_tier in ('IGNICION', 'EVOLUCION', 'ELITE')),

  constraint athlete_programs_service_focus_chk
    check (service_focus in ('PENDING', 'TRAINING', 'NUTRITION', 'BOTH')),

  constraint athlete_programs_status_chk
    check (status in (
      'PENDING_ACTIVATION',
      'SCHEDULED',
      'ACTIVE',
      'PAUSED',
      'EXPIRED',
      'CANCELLED'
    )),

  constraint athlete_programs_duration_pair_chk
    check (
      (duration_value is null and duration_unit is null)
      or (
        duration_value between 1 and 1200
        and duration_unit in ('DAY', 'WEEK', 'MONTH', 'YEAR')
      )
    ),

  constraint athlete_programs_dates_pair_chk
    check (
      (starts_at is null and ends_at is null)
      or (
        starts_at is not null
        and ends_at is not null
        and ends_at > starts_at
      )
    ),

  constraint athlete_programs_pending_contract_chk
    check (
      status <> 'PENDING_ACTIVATION'
      or (
        service_focus = 'PENDING'
        and duration_value is null
        and duration_unit is null
        and starts_at is null
        and ends_at is null
      )
    ),

  constraint athlete_programs_active_contract_chk
    check (
      status = 'PENDING_ACTIVATION'
      or (
        service_focus <> 'PENDING'
        and duration_value is not null
        and duration_unit is not null
        and starts_at is not null
        and ends_at is not null
      )
    ),

  constraint athlete_programs_focus_by_tier_chk
    check (
      (package_tier = 'IGNICION'
        and service_focus in ('PENDING', 'TRAINING', 'NUTRITION'))
      or
      (package_tier in ('EVOLUCION', 'ELITE')
        and service_focus in ('PENDING', 'BOTH'))
    )
);

create index if not exists athlete_programs_athlete_id_idx
  on public.athlete_programs (athlete_id, created_at desc);

create index if not exists athlete_programs_coach_id_idx
  on public.athlete_programs (coach_id, created_at desc);

create unique index if not exists athlete_programs_one_open_program_idx
  on public.athlete_programs (athlete_id)
  where status in (
    'PENDING_ACTIVATION',
    'SCHEDULED',
    'ACTIVE',
    'PAUSED'
  );

create or replace function private.genesis_program_end_at(
  p_starts_at timestamptz,
  p_duration_value integer,
  p_duration_unit text
)
returns timestamptz
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_duration_unit
    when 'DAY' then
      p_starts_at + pg_catalog.make_interval(days => p_duration_value)
    when 'WEEK' then
      p_starts_at + pg_catalog.make_interval(days => p_duration_value * 7)
    when 'MONTH' then
      p_starts_at + pg_catalog.make_interval(months => p_duration_value)
    when 'YEAR' then
      p_starts_at + pg_catalog.make_interval(years => p_duration_value)
    else null
  end;
$$;

revoke all on function private.genesis_program_end_at(timestamptz, integer, text)
  from public, anon, authenticated;

create or replace function public.genesis_coach_activate_athlete_program(
  p_athlete_id uuid,
  p_package_tier text,
  p_service_focus text,
  p_duration_value integer,
  p_duration_unit text,
  p_starts_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_role text;
  v_actor_coach_id uuid;
  v_athlete_coach_id uuid;
  v_is_onboarded boolean;
  v_package_tier text := upper(pg_catalog.btrim(coalesce(p_package_tier, '')));
  v_service_focus text := upper(pg_catalog.btrim(coalesce(p_service_focus, '')));
  v_duration_unit text := upper(pg_catalog.btrim(coalesce(p_duration_unit, '')));
  v_starts_at timestamptz := coalesce(p_starts_at, pg_catalog.now());
  v_ends_at timestamptz;
  v_status text;
  v_program_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'GENESIS_PROGRAM_AUTH_REQUIRED';
  end if;

  v_role := private.current_user_role();

  if v_role not in ('COACH', 'SUPER_ADMIN') then
    raise exception 'GENESIS_PROGRAM_ACTOR_FORBIDDEN';
  end if;

  select
    ap.coach_id,
    coalesce(ap.is_onboarded, false)
  into
    v_athlete_coach_id,
    v_is_onboarded
  from public.athletes_profile ap
  where ap.id = p_athlete_id
  for update;

  if not found then
    raise exception 'GENESIS_PROGRAM_ATHLETE_NOT_FOUND';
  end if;

  if not v_is_onboarded or v_athlete_coach_id is null then
    raise exception 'GENESIS_PROGRAM_ATHLETE_NOT_READY';
  end if;

  if v_role = 'COACH' then
    select cp.id
    into v_actor_coach_id
    from public.coaches_profile cp
    where cp.user_id = v_actor_user_id
    limit 1;

    if v_actor_coach_id is null
       or v_actor_coach_id is distinct from v_athlete_coach_id then
      raise exception 'GENESIS_PROGRAM_COACH_NOT_ASSIGNED';
    end if;
  end if;

  if v_package_tier not in ('IGNICION', 'EVOLUCION', 'ELITE') then
    raise exception 'GENESIS_PROGRAM_INVALID_PACKAGE_TIER';
  end if;

  if not private.coach_can_assign_athlete_plan(v_package_tier) then
    raise exception 'GENESIS_PROGRAM_PACKAGE_NOT_AUTHORIZED';
  end if;

  if v_package_tier = 'IGNICION'
     and v_service_focus not in ('TRAINING', 'NUTRITION') then
    raise exception 'GENESIS_PROGRAM_IGNICION_FOCUS_REQUIRED';
  end if;

  if v_package_tier in ('EVOLUCION', 'ELITE')
     and v_service_focus <> 'BOTH' then
    raise exception 'GENESIS_PROGRAM_COMPLETE_FOCUS_REQUIRED';
  end if;

  if p_duration_value is null
     or p_duration_value not between 1 and 1200
     or v_duration_unit not in ('DAY', 'WEEK', 'MONTH', 'YEAR') then
    raise exception 'GENESIS_PROGRAM_INVALID_DURATION';
  end if;

  v_ends_at := private.genesis_program_end_at(
    v_starts_at,
    p_duration_value,
    v_duration_unit
  );

  if v_ends_at is null or v_ends_at <= v_starts_at then
    raise exception 'GENESIS_PROGRAM_INVALID_END_DATE';
  end if;

  if exists (
    select 1
    from public.athlete_programs ap
    where ap.athlete_id = p_athlete_id
      and ap.status in (
        'PENDING_ACTIVATION',
        'SCHEDULED',
        'ACTIVE',
        'PAUSED'
      )
  ) then
    raise exception 'GENESIS_PROGRAM_OPEN_PROGRAM_EXISTS';
  end if;

  v_status := case
    when v_starts_at <= pg_catalog.now() then 'ACTIVE'
    else 'SCHEDULED'
  end;

  insert into public.athlete_programs (
    athlete_id,
    coach_id,
    package_tier,
    service_focus,
    duration_value,
    duration_unit,
    starts_at,
    ends_at,
    status,
    created_by
  )
  values (
    p_athlete_id,
    v_athlete_coach_id,
    v_package_tier,
    v_service_focus,
    p_duration_value,
    v_duration_unit,
    v_starts_at,
    v_ends_at,
    v_status,
    v_actor_user_id
  )
  returning id into v_program_id;

  update public.athletes_profile
  set
    b2c_plan = v_package_tier,
    program_start_date = v_starts_at,
    selected_app_single = case
      when v_service_focus = 'NUTRITION' then 'NUTRITION'
      else 'TRAINING'
    end
  where id = p_athlete_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'program_id', v_program_id,
    'athlete_id', p_athlete_id,
    'coach_id', v_athlete_coach_id,
    'package_tier', v_package_tier,
    'service_focus', v_service_focus,
    'duration_value', p_duration_value,
    'duration_unit', v_duration_unit,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at,
    'status', v_status
  );
end;
$$;

revoke all on function public.genesis_coach_activate_athlete_program(
  uuid,
  text,
  text,
  integer,
  text,
  timestamptz
) from public, anon;

grant execute on function public.genesis_coach_activate_athlete_program(
  uuid,
  text,
  text,
  integer,
  text,
  timestamptz
) to authenticated;

alter table public.athlete_programs enable row level security;

drop policy if exists athlete_programs_select_authorized
  on public.athlete_programs;

create policy athlete_programs_select_authorized
on public.athlete_programs
for select
to authenticated
using (
  private.is_super_admin()
  or exists (
    select 1
    from public.athletes_profile ap
    where ap.id = athlete_programs.athlete_id
      and ap.user_id = auth.uid()
  )
  or private.is_assigned_coach(athlete_programs.athlete_id)
);

revoke all on table public.athlete_programs from anon, authenticated;
grant select on table public.athlete_programs to authenticated;

comment on table public.athlete_programs is
  'Genesis C3B14 athlete program contracts with coach-controlled duration and server-calculated expiration.';
