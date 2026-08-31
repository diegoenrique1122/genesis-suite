-- ============================================================================
-- GENESIS OS — 002B6.B
-- ATHLETE DOMAIN AUTHORITY
--
-- PURPOSE
-- -------
-- Establish server-side domain authority for commercial ATHLETE profiles
-- without corrupting or blocking historical legacy records.
--
-- CANONICAL DOMAIN
-- ----------------
-- age        : 14..99
-- weight     : 20..500 kilograms
-- height     : 50..300 centimeters
-- gender     : Masculino | Femenino
-- goal       : Pérdida de Grasa | Ganancia Muscular | Recomposición
-- full_name  : trimmed, non-blank when present, max 120
-- injuries   : optional; when present, trimmed, non-blank, max 2000
--
-- IMPORTANT LEGACY RULE
-- ---------------------
-- Existing historical invalid/noncanonical values are grandfathered until
-- that specific field is changed.
--
-- An unrelated update therefore does NOT force legacy records through the
-- new domain contract.
--
-- IMMERSIVE PROFILES
-- ------------------
-- COACH and SUPER_ADMIN operational Athlete profiles are intentionally
-- outside the normal commercial ATHLETE onboarding contract.
--
-- ============================================================================


-- ============================================================================
-- DOMAIN AUTHORITY TRIGGER FUNCTION
-- ============================================================================

create function private.validate_athlete_domain_authority()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_master_role text;
  v_require_complete boolean := false;
begin

  -- ==========================================================================
  -- IDENTITY CLASSIFICATION
  -- ==========================================================================

  select
    um.role::text
  into
    v_master_role
  from public.users_master um
  where um.id = new.user_id
  limit 1;


  if v_master_role is null then
    raise exception
      'GENESIS_DOMAIN: athlete identity not found';
  end if;


  -- Coach / SuperAdmin immersive Athlete profiles have their own operational
  -- contract and are not commercial ATHLETE onboarding records.
  if v_master_role <> 'ATHLETE' then
    return new;
  end if;


  -- ==========================================================================
  -- INSERT CONTRACT
  --
  -- Pending ATHLETE profiles are allowed to contain NULL biometrics.
  -- This is required by the secure signup pipeline.
  --
  -- Any value that IS supplied must already be canonical.
  -- ==========================================================================

  if tg_op = 'INSERT' then


    if new.age is not null
       and new.age not between 14 and 99 then

      raise exception
        'GENESIS_DOMAIN: age must be between 14 and 99';

    end if;


    if new.weight is not null
       and new.weight not between 20 and 500 then

      raise exception
        'GENESIS_DOMAIN: weight must be between 20 and 500 kg';

    end if;


    if new.height is not null
       and new.height not between 50 and 300 then

      raise exception
        'GENESIS_DOMAIN: height must be between 50 and 300 cm';

    end if;


    if new.gender is not null
       and new.gender not in (
         'Masculino',
         'Femenino'
       ) then

      raise exception
        'GENESIS_DOMAIN: invalid gender';

    end if;


    if new.goal is not null
       and new.goal not in (
         'Pérdida de Grasa',
         'Ganancia Muscular',
         'Recomposición'
       ) then

      raise exception
        'GENESIS_DOMAIN: invalid goal';

    end if;


    if new.full_name is not null
       and (
         nullif(
           btrim(new.full_name),
           ''
         ) is null

         or char_length(new.full_name) > 120

         or new.full_name <> btrim(new.full_name)
       ) then

      raise exception
        'GENESIS_DOMAIN: invalid full name';

    end if;


    if new.injuries is not null
       and (
         nullif(
           btrim(new.injuries),
           ''
         ) is null

         or char_length(new.injuries) > 2000

         or new.injuries <> btrim(new.injuries)
       ) then

      raise exception
        'GENESIS_DOMAIN: invalid injuries text';

    end if;


    v_require_complete :=
      coalesce(
        new.is_onboarded,
        false
      );


  -- ==========================================================================
  -- UPDATE CONTRACT
  --
  -- Only CHANGED domain fields are validated.
  --
  -- Examples:
  --
  -- legacy height 1.53 + discipline_metrics update
  --   -> allowed
  --
  -- legacy height 1.53 -> height 1.54
  --   -> rejected
  --
  -- legacy height 1.53 -> height 154
  --   -> accepted
  -- ==========================================================================

  else


    -- ------------------------------------------------------------------------
    -- AGE
    -- ------------------------------------------------------------------------

    if new.age is distinct from old.age then

      if new.age is not null
         and new.age not between 14 and 99 then

        raise exception
          'GENESIS_DOMAIN: age must be between 14 and 99';

      end if;


      if coalesce(
           new.is_onboarded,
           false
         )
         and new.age is null then

        raise exception
          'GENESIS_DOMAIN: age required for onboarded athlete';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- WEIGHT
    -- ------------------------------------------------------------------------

    if new.weight is distinct from old.weight then

      if new.weight is not null
         and new.weight not between 20 and 500 then

        raise exception
          'GENESIS_DOMAIN: weight must be between 20 and 500 kg';

      end if;


      if coalesce(
           new.is_onboarded,
           false
         )
         and new.weight is null then

        raise exception
          'GENESIS_DOMAIN: weight required for onboarded athlete';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- HEIGHT
    -- ------------------------------------------------------------------------

    if new.height is distinct from old.height then

      if new.height is not null
         and new.height not between 50 and 300 then

        raise exception
          'GENESIS_DOMAIN: height must be between 50 and 300 cm';

      end if;


      if coalesce(
           new.is_onboarded,
           false
         )
         and new.height is null then

        raise exception
          'GENESIS_DOMAIN: height required for onboarded athlete';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- GENDER
    -- ------------------------------------------------------------------------

    if new.gender is distinct from old.gender then

      if new.gender is not null
         and new.gender not in (
           'Masculino',
           'Femenino'
         ) then

        raise exception
          'GENESIS_DOMAIN: invalid gender';

      end if;


      if coalesce(
           new.is_onboarded,
           false
         )
         and new.gender is null then

        raise exception
          'GENESIS_DOMAIN: gender required for onboarded athlete';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- GOAL
    -- ------------------------------------------------------------------------

    if new.goal is distinct from old.goal then

      if new.goal is not null
         and new.goal not in (
           'Pérdida de Grasa',
           'Ganancia Muscular',
           'Recomposición'
         ) then

        raise exception
          'GENESIS_DOMAIN: invalid goal';

      end if;


      if coalesce(
           new.is_onboarded,
           false
         )
         and new.goal is null then

        raise exception
          'GENESIS_DOMAIN: goal required for onboarded athlete';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- FULL NAME
    -- ------------------------------------------------------------------------

    if new.full_name is distinct from old.full_name then

      if new.full_name is not null
         and (
           nullif(
             btrim(new.full_name),
             ''
           ) is null

           or char_length(new.full_name) > 120

           or new.full_name <> btrim(new.full_name)
         ) then

        raise exception
          'GENESIS_DOMAIN: invalid full name';

      end if;


      if coalesce(
           new.is_onboarded,
           false
         )
         and new.full_name is null then

        raise exception
          'GENESIS_DOMAIN: full name required for onboarded athlete';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- INJURIES
    -- ------------------------------------------------------------------------

    if new.injuries is distinct from old.injuries then

      if new.injuries is not null
         and (
           nullif(
             btrim(new.injuries),
             ''
           ) is null

           or char_length(new.injuries) > 2000

           or new.injuries <> btrim(new.injuries)
         ) then

        raise exception
          'GENESIS_DOMAIN: invalid injuries text';

      end if;

    end if;


    -- ------------------------------------------------------------------------
    -- LEGAL ACCEPTANCE
    --
    -- Historical false values are preserved if untouched.
    -- A confirmed commercial ATHLETE cannot be actively rewritten to false
    -- while remaining onboarded.
    -- ------------------------------------------------------------------------

    if new.legal_accepted
         is distinct from
       old.legal_accepted

       and coalesce(
         new.is_onboarded,
         false
       )

       and new.legal_accepted
         is not true then

      raise exception
        'GENESIS_DOMAIN: legal acceptance required for onboarded athlete';

    end if;


    -- A complete profile is required ONLY when entering onboarding=true.
    --
    -- NULL -> TRUE and FALSE -> TRUE are both onboarding transitions.
    v_require_complete :=
      coalesce(
        old.is_onboarded,
        false
      ) = false

      and

      coalesce(
        new.is_onboarded,
        false
      ) = true;

  end if;


  -- ==========================================================================
  -- COMPLETE COMMERCIAL ATHLETE CONTRACT
  -- ==========================================================================

  if v_require_complete then


    if new.full_name is null
       or nullif(
         btrim(new.full_name),
         ''
       ) is null
       or char_length(new.full_name) > 120
       or new.full_name <> btrim(new.full_name) then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.age is null
       or new.age not between 14 and 99 then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.weight is null
       or new.weight not between 20 and 500 then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.height is null
       or new.height not between 50 and 300 then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    -- Explicit NULL handling is intentional.
    -- PostgreSQL NULL NOT IN (...) is NULL rather than TRUE.
    if new.gender is null
       or new.gender not in (
         'Masculino',
         'Femenino'
       ) then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.goal is null
       or new.goal not in (
         'Pérdida de Grasa',
         'Ganancia Muscular',
         'Recomposición'
       ) then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.injuries is not null
       and (
         nullif(
           btrim(new.injuries),
           ''
         ) is null

         or char_length(new.injuries) > 2000

         or new.injuries <> btrim(new.injuries)
       ) then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.coach_id is null then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;


    if new.legal_accepted is not true then

      raise exception
        'GENESIS_DOMAIN: complete canonical athlete profile required before onboarding';

    end if;

  end if;


  return new;

end;
$function$;


-- ============================================================================
-- EXECUTION BOUNDARY
-- ============================================================================

revoke all
on function private.validate_athlete_domain_authority()
from public, anon, authenticated;


-- ============================================================================
-- TRIGGER
--
-- Existing trg_guard_athlete_profile_authority continues to protect ownership,
-- commercial plan and system authority.
--
-- This trigger owns only canonical domain validation.
--
-- It intentionally does NOT fire for updates such as discipline_metrics,
-- training_plan or routine_status unless one of these domain fields is also
-- part of the UPDATE.
-- ============================================================================

create trigger trg_validate_athlete_domain_authority

before insert

   or update of
     full_name,
     age,
     weight,
     height,
     gender,
     goal,
     injuries,
     is_onboarded,
     legal_accepted

on public.athletes_profile

for each row

execute function
  private.validate_athlete_domain_authority();


comment on function private.validate_athlete_domain_authority() is
'Genesis 002B6.B: server-side canonical athlete domain authority. Validates new or changed commercial ATHLETE biometric/onboarding fields while grandfathering untouched legacy values and exempting COACH/SUPER_ADMIN immersive profiles.';