-- Genesis OS 002B6.A2B
-- Private onboarding photo path authority.
--
-- GOALS:
-- 1. Keep compatibility with the current frontend while it still sends
--    syntactic athlete_evidence public URLs.
-- 2. Normalize every onboarding photo input to a Storage object path.
-- 3. Validate that every path belongs to the authenticated athlete.
-- 4. Validate that all three physical objects exist in athlete_evidence.
-- 5. Store canonical front_path / side_path / back_path.
-- 6. Stop persisting public URL strings for new onboardings.
--
-- Historical athlete_photos rows are not modified by this migration.


-- ============================================================================
-- PRIVATE INPUT NORMALIZER
-- ============================================================================
--
-- Accepts:
--
--   progress_photos/<athlete_id>_week0_front_....jpg
--
--   <athlete_id>/week_0/front/....jpg
--
-- and transitional Supabase URL forms containing:
--
--   /storage/v1/object/public/athlete_evidence/
--   /storage/v1/object/sign/athlete_evidence/
--   /storage/v1/object/authenticated/athlete_evidence/
--
-- Returns only the Storage object name/path.
-- ============================================================================

create or replace function private.normalize_athlete_evidence_input(
  p_value text
)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_value text;
begin
  v_value := nullif(
    btrim(p_value),
    ''
  );

  if v_value is null then
    return null;
  end if;


  if strpos(
    v_value,
    '/storage/v1/object/public/athlete_evidence/'
  ) > 0 then

    v_value := split_part(
      v_value,
      '/storage/v1/object/public/athlete_evidence/',
      2
    );


  elsif strpos(
    v_value,
    '/storage/v1/object/sign/athlete_evidence/'
  ) > 0 then

    v_value := split_part(
      v_value,
      '/storage/v1/object/sign/athlete_evidence/',
      2
    );


  elsif strpos(
    v_value,
    '/storage/v1/object/authenticated/athlete_evidence/'
  ) > 0 then

    v_value := split_part(
      v_value,
      '/storage/v1/object/authenticated/athlete_evidence/',
      2
    );

  end if;


  -- Strip URL query strings / fragments if a transitional URL was supplied.
  v_value := split_part(
    v_value,
    '?',
    1
  );

  v_value := split_part(
    v_value,
    '#',
    1
  );


  -- Storage object names must not begin with "/".
  v_value := regexp_replace(
    v_value,
    '^/+',
    ''
  );


  return nullif(
    btrim(v_value),
    ''
  );
end;
$function$;


-- This helper is intentionally NOT a client RPC.
revoke all
on function private.normalize_athlete_evidence_input(text)
from public, anon, authenticated;


-- ============================================================================
-- COMPLETE ATHLETE ONBOARDING
-- ============================================================================
--
-- IMPORTANT COMPATIBILITY NOTE:
--
-- Parameter names remain p_front_url / p_side_url / p_back_url temporarily.
--
-- Old frontend:
--   sends syntactic public URLs -> normalized here.
--
-- New frontend:
--   will send direct private object paths -> accepted here.
--
-- This avoids breaking production during the frontend cutover.
-- ============================================================================

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

  v_front_path text;
  v_side_path text;
  v_back_path text;

  v_evidence_object_count integer;
  v_rows_updated integer;
begin

  -- ==========================================================================
  -- CALLER AUTHORITY
  -- ==========================================================================

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


  -- Lock profile before checking one-time onboarding state.
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


  if v_is_onboarded
     or v_existing_coach_id is not null then
    raise exception 'ONBOARDING_ALREADY_COMPLETED';
  end if;


  -- ==========================================================================
  -- BASIC INPUT AUTHORITY
  -- ==========================================================================

  if coalesce(
    p_legal_accepted,
    false
  ) is not true then
    raise exception 'LEGAL_ACCEPTANCE_REQUIRED';
  end if;


  if nullif(
    trim(
      coalesce(
        p_code,
        ''
      )
    ),
    ''
  ) is null then
    raise exception 'INVITE_CODE_REQUIRED';
  end if;


  if nullif(
    trim(
      coalesce(
        p_full_name,
        ''
      )
    ),
    ''
  ) is null then
    raise exception 'FULL_NAME_REQUIRED';
  end if;


  -- ==========================================================================
  -- PRIVATE EVIDENCE NORMALIZATION
  -- ==========================================================================

  v_front_path :=
    private.normalize_athlete_evidence_input(
      p_front_url
    );

  v_side_path :=
    private.normalize_athlete_evidence_input(
      p_side_url
    );

  v_back_path :=
    private.normalize_athlete_evidence_input(
      p_back_url
    );


  if v_front_path is null
     or v_side_path is null
     or v_back_path is null then
    raise exception 'THREE_PHOTOS_REQUIRED';
  end if;


  -- The same object cannot represent multiple physical views.
  if v_front_path = v_side_path
     or v_front_path = v_back_path
     or v_side_path = v_back_path then
    raise exception 'ONBOARDING_PHOTO_PATHS_MUST_BE_DISTINCT';
  end if;


  -- ==========================================================================
  -- STORAGE PATH OWNERSHIP
  -- ==========================================================================

  if private.athlete_id_from_evidence_object_name(
       v_front_path
     ) is distinct from v_athlete_id then
    raise exception 'FRONT_PHOTO_PATH_OWNERSHIP_INVALID';
  end if;


  if private.athlete_id_from_evidence_object_name(
       v_side_path
     ) is distinct from v_athlete_id then
    raise exception 'SIDE_PHOTO_PATH_OWNERSHIP_INVALID';
  end if;


  if private.athlete_id_from_evidence_object_name(
       v_back_path
     ) is distinct from v_athlete_id then
    raise exception 'BACK_PHOTO_PATH_OWNERSHIP_INVALID';
  end if;


  -- ==========================================================================
  -- WEEK-0 VIEW PATH CONTRACT
  -- ==========================================================================
  --
  -- Transitional current layout:
  --
  -- progress_photos/<athlete_id>_week0_front_...
  --
  -- Future canonical layout:
  --
  -- <athlete_id>/week_0/front/...
  -- ==========================================================================

  if not (
    v_front_path like (
      'progress_photos/'
      || v_athlete_id::text
      || '_week0_front_%'
    )

    or

    v_front_path like (
      v_athlete_id::text
      || '/week_0/front/%'
    )
  ) then
    raise exception 'INVALID_FRONT_WEEK0_PHOTO_PATH';
  end if;


  if not (
    v_side_path like (
      'progress_photos/'
      || v_athlete_id::text
      || '_week0_side_%'
    )

    or

    v_side_path like (
      v_athlete_id::text
      || '/week_0/side/%'
    )
  ) then
    raise exception 'INVALID_SIDE_WEEK0_PHOTO_PATH';
  end if;


  if not (
    v_back_path like (
      'progress_photos/'
      || v_athlete_id::text
      || '_week0_back_%'
    )

    or

    v_back_path like (
      v_athlete_id::text
      || '/week_0/back/%'
    )
  ) then
    raise exception 'INVALID_BACK_WEEK0_PHOTO_PATH';
  end if;


  -- ==========================================================================
  -- PHYSICAL STORAGE OBJECT VERIFICATION
  -- ==========================================================================
  --
  -- SECURITY DEFINER means this verification does not trust client claims.
  -- All three object names must physically exist in the private bucket.
  -- ==========================================================================

  select
    count(*)
  into
    v_evidence_object_count
  from storage.objects o
  where o.bucket_id = 'athlete_evidence'
    and o.name = any(
      array[
        v_front_path,
        v_side_path,
        v_back_path
      ]
    );


  if v_evidence_object_count <> 3 then
    raise exception 'ONBOARDING_EVIDENCE_OBJECT_MISSING';
  end if;


  -- ==========================================================================
  -- COACH / PLAN AUTHORITY
  -- ==========================================================================

  select
    c.id,
    c.user_id,

    case
      when upper(c.invite_code_ignicion) =
           upper(trim(p_code))
        then 'IGNICION'

      when upper(c.invite_code_evolucion) =
           upper(trim(p_code))
        then 'EVOLUCION'

      when upper(c.invite_code_elite) =
           upper(trim(p_code))
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

  where u.account_status =
        'ACTIVE'::public.account_status

    and upper(trim(p_code)) in (
      upper(
        coalesce(
          c.invite_code_ignicion,
          ''
        )
      ),

      upper(
        coalesce(
          c.invite_code_evolucion,
          ''
        )
      ),

      upper(
        coalesce(
          c.invite_code_elite,
          ''
        )
      )
    )

    and (
      upper(c.invite_code_ignicion) =
      upper(trim(p_code))

      or

      upper(c.invite_code_evolucion) =
      upper(trim(p_code))

      or

      (
        upper(c.invite_code_elite) =
        upper(trim(p_code))

        and c.b2b_plan in (
          'EVOLUCION',
          'ELITE'
        )
      )
    )

  limit 1;


  if v_coach_id is null
     or v_plan is null then
    raise exception 'INVALID_OR_UNAUTHORIZED_INVITE_CODE';
  end if;


  -- ==========================================================================
  -- ATOMIC ATHLETE ACTIVATION
  -- ==========================================================================

  update public.athletes_profile as ap
  set
    full_name =
      trim(p_full_name),

    coach_id =
      v_coach_id,

    b2c_plan =
      v_plan,

    age =
      p_age,

    weight =
      p_weight,

    height =
      p_height,

    gender =
      p_gender,

    goal =
      p_goal,

    injuries =
      coalesce(
        nullif(
          trim(
            coalesce(
              p_injuries,
              ''
            )
          ),
          ''
        ),
        'Ninguna'
      ),

    is_onboarded =
      true,

    legal_accepted =
      true,

    program_start_date =
      null

  where ap.id = v_athlete_id
    and ap.user_id = v_user_id
    and coalesce(
      ap.is_onboarded,
      false
    ) = false
    and ap.coach_id is null;


  get diagnostics
    v_rows_updated = row_count;


  if v_rows_updated <> 1 then
    raise exception 'ONBOARDING_STATE_CHANGED';
  end if;


  -- ==========================================================================
  -- WEEK-0 PHOTO RECORD
  -- ==========================================================================
  --
  -- URL columns remain in the schema only for historical compatibility.
  -- New onboarding writes canonical PRIVATE paths and NULL legacy URLs.
  -- ==========================================================================

  insert into public.athlete_photos (
    athlete_id,
    coach_id,
    week_number,

    front_url,
    side_url,
    back_url,

    front_path,
    side_path,
    back_path,

    weight_recorded
  )
  values (
    v_athlete_id,
    v_coach_id,
    0,

    null,
    null,
    null,

    v_front_path,
    v_side_path,
    v_back_path,

    p_weight
  )

  on conflict on constraint unique_athlete_week

  do update
  set
    coach_id =
      excluded.coach_id,

    front_url =
      null,

    side_url =
      null,

    back_url =
      null,

    front_path =
      excluded.front_path,

    side_path =
      excluded.side_path,

    back_path =
      excluded.back_path,

    weight_recorded =
      excluded.weight_recorded;


  -- ==========================================================================
  -- COACH NOTIFICATION
  -- ==========================================================================

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


-- ============================================================================
-- EXECUTION BOUNDARY
-- ============================================================================

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