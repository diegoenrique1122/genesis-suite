-- Canonicalize system notification recipients to users_master IDs.
update public.system_notifications sn
set recipient_id = cp.user_id
from public.coaches_profile cp
where sn.recipient_role = 'COACH'
  and sn.recipient_id = cp.id;

alter table public.system_notifications
  add constraint system_notifications_recipient_id_fkey
  foreign key (recipient_id)
  references public.users_master(id)
  on delete cascade;

-- Replace invite resolver so it also returns the canonical Coach user ID.
drop function if exists public.resolve_coach_invite(text);

create function public.resolve_coach_invite(p_code text)
returns table (
  coach_id uuid,
  coach_user_id uuid,
  coach_name text,
  athlete_plan text
)
language sql
stable
security definer
set search_path = ''
as $$
  with matched as (
    select
      c.id,
      c.user_id,
      c.full_name,
      c.b2b_plan,
      case
        when upper(c.invite_code_ignicion) = upper(trim(p_code)) then 'IGNICION'
        when upper(c.invite_code_evolucion) = upper(trim(p_code)) then 'EVOLUCION'
        when upper(c.invite_code_elite) = upper(trim(p_code)) then 'ELITE'
        else null
      end as requested_plan
    from public.coaches_profile c
    join public.users_master u on u.id = c.user_id
    where (select auth.uid()) is not null
      and u.account_status = 'ACTIVE'::public.account_status
      and upper(trim(p_code)) in (
        upper(coalesce(c.invite_code_ignicion, '')),
        upper(coalesce(c.invite_code_evolucion, '')),
        upper(coalesce(c.invite_code_elite, ''))
      )
    limit 1
  )
  select
    id as coach_id,
    user_id as coach_user_id,
    full_name as coach_name,
    requested_plan as athlete_plan
  from matched
  where requested_plan in ('IGNICION','EVOLUCION')
     or (requested_plan = 'ELITE' and b2b_plan in ('EVOLUCION','ELITE'));
$$;

revoke all on function public.resolve_coach_invite(text) from public;
revoke all on function public.resolve_coach_invite(text) from anon;
grant execute on function public.resolve_coach_invite(text) to authenticated;

-- Atomic onboarding: the browser no longer chooses coach_id or b2c_plan.
create function public.complete_athlete_onboarding(
  p_code text,
  p_full_name text,
  p_age integer,
  p_weight numeric,
  p_height numeric,
  p_gender text,
  p_goal text,
  p_injuries text,
  p_front_url text,
  p_side_url text,
  p_back_url text,
  p_legal_accepted boolean
)
returns table (
  athlete_id uuid,
  coach_id uuid,
  coach_user_id uuid,
  athlete_plan text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_athlete_id uuid;
  v_coach_id uuid;
  v_coach_user_id uuid;
  v_plan text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.users_master u
    where u.id = v_user_id
      and u.role = 'ATHLETE'::public.user_role
      and u.account_status = 'ACTIVE'::public.account_status
  ) then
    raise exception 'ATHLETE_ACCOUNT_NOT_ACTIVE';
  end if;

  if coalesce(p_legal_accepted, false) is not true then
    raise exception 'LEGAL_ACCEPTANCE_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_code, '')), '') is null then
    raise exception 'INVITE_CODE_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'FULL_NAME_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_front_url, '')), '') is null
     or nullif(trim(coalesce(p_side_url, '')), '') is null
     or nullif(trim(coalesce(p_back_url, '')), '') is null then
    raise exception 'THREE_PHOTOS_REQUIRED';
  end if;

  select ap.id
  into v_athlete_id
  from public.athletes_profile ap
  where ap.user_id = v_user_id
  for update;

  if v_athlete_id is null then
    raise exception 'ATHLETE_PROFILE_NOT_FOUND';
  end if;

  select
    c.id,
    c.user_id,
    case
      when upper(c.invite_code_ignicion) = upper(trim(p_code)) then 'IGNICION'
      when upper(c.invite_code_evolucion) = upper(trim(p_code)) then 'EVOLUCION'
      when upper(c.invite_code_elite) = upper(trim(p_code)) then 'ELITE'
      else null
    end
  into v_coach_id, v_coach_user_id, v_plan
  from public.coaches_profile c
  join public.users_master u on u.id = c.user_id
  where u.account_status = 'ACTIVE'::public.account_status
    and upper(trim(p_code)) in (
      upper(coalesce(c.invite_code_ignicion, '')),
      upper(coalesce(c.invite_code_evolucion, '')),
      upper(coalesce(c.invite_code_elite, ''))
    )
    and (
      upper(c.invite_code_ignicion) = upper(trim(p_code))
      or upper(c.invite_code_evolucion) = upper(trim(p_code))
      or (
        upper(c.invite_code_elite) = upper(trim(p_code))
        and c.b2b_plan in ('EVOLUCION','ELITE')
      )
    )
  limit 1;

  if v_coach_id is null or v_plan is null then
    raise exception 'INVALID_OR_UNAUTHORIZED_INVITE_CODE';
  end if;

  update public.athletes_profile
  set
    full_name = trim(p_full_name),
    coach_id = v_coach_id,
    b2c_plan = v_plan,
    age = p_age,
    weight = p_weight,
    height = p_height,
    gender = p_gender,
    goal = p_goal,
    injuries = coalesce(nullif(trim(coalesce(p_injuries, '')), ''), 'Ninguna'),
    is_onboarded = true,
    legal_accepted = true,
    program_start_date = null
  where id = v_athlete_id;

  insert into public.athlete_photos (
    athlete_id,
    coach_id,
    week_number,
    front_url,
    side_url,
    back_url,
    weight_recorded
  ) values (
    v_athlete_id,
    v_coach_id,
    0,
    p_front_url,
    p_side_url,
    p_back_url,
    p_weight
  )
  on conflict (athlete_id, week_number)
  do update set
    coach_id = excluded.coach_id,
    front_url = excluded.front_url,
    side_url = excluded.side_url,
    back_url = excluded.back_url,
    weight_recorded = excluded.weight_recorded;

  insert into public.system_notifications (
    recipient_role,
    recipient_id,
    title,
    message,
    type
  ) values (
    'COACH',
    v_coach_user_id,
    '¡Nuevo Atleta en Sala de Espera!',
    'El atleta ' || trim(p_full_name) || ' ha completado su biometría, firmado el contrato y subido sus fotos.',
    'NEW_ATHLETE'
  );

  return query
  select v_athlete_id, v_coach_id, v_coach_user_id, v_plan;
end;
$$;

revoke all on function public.complete_athlete_onboarding(text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean) from public;
revoke all on function public.complete_athlete_onboarding(text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean) from anon;
grant execute on function public.complete_athlete_onboarding(text,text,integer,numeric,numeric,text,text,text,text,text,text,boolean) to authenticated;;
