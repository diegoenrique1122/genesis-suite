-- Genesis OS 002B6.A2A
-- Harden privileged onboarding RPC authority.
--
-- Scope:
-- - prevent athlete re-onboarding / coach reassignment
-- - restrict invite resolution to active, not-yet-onboarded athletes
-- - preserve current photo pipeline unchanged

create or replace function public.complete_athlete_onboarding(
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
returns table(
  athlete_id uuid,
  coach_id uuid,
  coach_user_id uuid,
  athlete_plan text
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());

  v_athlete_id uuid;
  v_existing_coach_id uuid;
  v_is_onboarded boolean;

  v_coach_id uuid;
  v_coach_user_id uuid;
  v_plan text;

  v_rows_updated integer;
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

  -- Lock the caller's athlete profile before any onboarding mutation.
  select
    ap.id,
    ap.coach_id,
    coalesce(ap.is_onboarded, false)
  into
    v_athlete_id,
    v_existing_coach_id,
    v_is_onboarded
  from public.athletes_profile ap
  where ap.user_id = v_user_id
  for update;

  if v_athlete_id is null then
    raise exception 'ATHLETE_PROFILE_NOT_FOUND';
  end if;

  -- Onboarding is a one-time authority transition.
  --
  -- A caller cannot use this SECURITY DEFINER RPC to:
  -- - change Coach
  -- - change B2C plan
  -- - rewrite week-0 onboarding
  -- after activation.
  if v_is_onboarded
     or v_existing_coach_id is not null then
    raise exception 'ONBOARDING_ALREADY_COMPLETED';
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

  select
    c.id,
    c.user_id,
    case
      when upper(c.invite_code_ignicion) = upper(trim(p_code))
        then 'IGNICION'

      when upper(c.invite_code_evolucion) = upper(trim(p_code))
        then 'EVOLUCION'

      when upper(c.invite_code_elite) = upper(trim(p_code))
        then 'ELITE'

      else null
    end
  into
    v_coach_id,
    v_coach_user_id,
    v_plan
  from public.coaches_profile c
  join public.users_master u
    on u.id = c.user_id
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
        and c.b2b_plan in ('EVOLUCION', 'ELITE')
      )
    )

  limit 1;

  if v_coach_id is null
     or v_plan is null then
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
    injuries = coalesce(
      nullif(
        trim(
          coalesce(p_injuries, '')
        ),
        ''
      ),
      'Ninguna'
    ),
    is_onboarded = true,
    legal_accepted = true,
    program_start_date = null
  where id = v_athlete_id
    and user_id = v_user_id
    and coalesce(is_onboarded, false) = false
    and coach_id is null;

  get diagnostics
    v_rows_updated = row_count;

  if v_rows_updated <> 1 then
    raise exception 'ONBOARDING_STATE_CHANGED';
  end if;

  insert into public.athlete_photos (
    athlete_id,
    coach_id,
    week_number,
    front_url,
    side_url,
    back_url,
    weight_recorded
  )
  values (
    v_athlete_id,
    v_coach_id,
    0,
    p_front_url,
    p_side_url,
    p_back_url,
    p_weight
  )
  on conflict (athlete_id, week_number)
  do update
  set
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
  )
  values (
    'COACH',
    v_coach_user_id,
    '¡Nuevo Atleta en Sala de Espera!',
    'El atleta '
      || trim(p_full_name)
      || ' ha completado su biometría, firmado el contrato y subido sus fotos.',
    'NEW_ATHLETE'
  );

  return query
  select
    v_athlete_id,
    v_coach_id,
    v_coach_user_id,
    v_plan;
end;
$function$;


create or replace function public.resolve_coach_invite(
  p_code text
)
returns table(
  coach_id uuid,
  coach_user_id uuid,
  coach_name text,
  athlete_plan text
)
language sql
stable
security definer
set search_path to ''
as $function$

  with caller as (
    select
      ap.id as athlete_id
    from public.users_master u
    join public.athletes_profile ap
      on ap.user_id = u.id
    where u.id = (select auth.uid())
      and u.role = 'ATHLETE'::public.user_role
      and u.account_status = 'ACTIVE'::public.account_status
      and coalesce(ap.is_onboarded, false) = false
      and ap.coach_id is null
    limit 1
  ),

  matched as (
    select
      c.id,
      c.user_id,
      c.full_name,
      c.b2b_plan,

      case
        when upper(c.invite_code_ignicion) = upper(trim(p_code))
          then 'IGNICION'

        when upper(c.invite_code_evolucion) = upper(trim(p_code))
          then 'EVOLUCION'

        when upper(c.invite_code_elite) = upper(trim(p_code))
          then 'ELITE'

        else null
      end as requested_plan

    from public.coaches_profile c

    join public.users_master u
      on u.id = c.user_id

    where exists (
      select 1
      from caller
    )

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

  where requested_plan in (
    'IGNICION',
    'EVOLUCION'
  )

  or (
    requested_plan = 'ELITE'
    and b2b_plan in (
      'EVOLUCION',
      'ELITE'
    )
  );

$function$;


-- Explicit execution boundary.
revoke all
on function public.complete_athlete_onboarding(
  text,
  text,
  integer,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
from public;

revoke all
on function public.complete_athlete_onboarding(
  text,
  text,
  integer,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
from anon;

grant execute
on function public.complete_athlete_onboarding(
  text,
  text,
  integer,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated, service_role;


revoke all
on function public.resolve_coach_invite(text)
from public;

revoke all
on function public.resolve_coach_invite(text)
from anon;

grant execute
on function public.resolve_coach_invite(text)
to authenticated, service_role;