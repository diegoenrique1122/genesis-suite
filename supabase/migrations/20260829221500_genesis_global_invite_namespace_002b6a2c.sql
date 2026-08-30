-- ============================================================
-- GENESIS OS 002B6.A2C
-- GLOBAL COACH INVITE NAMESPACE AUTHORITY
--
-- Security objectives:
--
-- 1. Normalize invite codes as UPPER(TRIM(code)).
-- 2. Empty invite strings become NULL.
-- 3. A normalized invite code may exist only ONCE globally,
--    regardless of Coach or plan column.
-- 4. Preserve existing per-column UNIQUE constraints.
-- 5. Keep the authority registry inaccessible to clients.
-- 6. Synchronize registry transactionally with coaches_profile.
-- ============================================================


-- ============================================================
-- 1. PRIVATE GLOBAL REGISTRY
-- ============================================================

create table if not exists private.coach_invite_registry (

  normalized_code text
    primary key,

  coach_id uuid
    not null
    references public.coaches_profile(id)
    on update cascade
    on delete cascade,

  invite_plan text
    not null
    check (
      invite_plan in (
        'IGNICION',
        'EVOLUCION',
        'ELITE'
      )
    ),

  created_at timestamptz
    not null
    default now(),

  constraint coach_invite_registry_coach_plan_key
    unique (
      coach_id,
      invite_plan
    ),

  constraint coach_invite_registry_normalized_code_chk
    check (
      normalized_code <> ''
      and normalized_code = upper(btrim(normalized_code))
    )
);


-- Never expose the authority registry directly to clients.
revoke all
on table private.coach_invite_registry
from public, anon, authenticated;


-- ============================================================
-- 2. CANONICAL INVITE NORMALIZER
-- ============================================================

create or replace function private.normalize_coach_invite_code(
  p_code text
)
returns text
language sql
immutable
strict
set search_path to ''
as $function$

  select nullif(
    upper(
      btrim(p_code)
    ),
    ''
  );

$function$;


revoke all
on function private.normalize_coach_invite_code(text)
from public, anon, authenticated;


-- ============================================================
-- 3. NORMALIZE coaches_profile BEFORE WRITE
-- ============================================================

create or replace function private.normalize_coach_invite_codes()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin

  new.invite_code_ignicion :=
    case
      when new.invite_code_ignicion is null
        then null
      else private.normalize_coach_invite_code(
        new.invite_code_ignicion
      )
    end;


  new.invite_code_evolucion :=
    case
      when new.invite_code_evolucion is null
        then null
      else private.normalize_coach_invite_code(
        new.invite_code_evolucion
      )
    end;


  new.invite_code_elite :=
    case
      when new.invite_code_elite is null
        then null
      else private.normalize_coach_invite_code(
        new.invite_code_elite
      )
    end;


  return new;

end;
$function$;


revoke all
on function private.normalize_coach_invite_codes()
from public, anon, authenticated;


drop trigger if exists
  trg_00_normalize_coach_invite_codes
on public.coaches_profile;


create trigger
  trg_00_normalize_coach_invite_codes

before insert
or update of
  invite_code_ignicion,
  invite_code_evolucion,
  invite_code_elite

on public.coaches_profile

for each row

execute function private.normalize_coach_invite_codes();


-- ============================================================
-- 4. SOURCE-TABLE NORMALIZATION CHECKS
--
-- Trigger normalizes automatically.
-- CHECK constraints provide secondary declarative defense.
-- ============================================================

alter table public.coaches_profile
  drop constraint if exists
    coaches_profile_invite_ignicion_normalized_chk;

alter table public.coaches_profile
  add constraint
    coaches_profile_invite_ignicion_normalized_chk
  check (
    invite_code_ignicion is null
    or (
      invite_code_ignicion <> ''
      and invite_code_ignicion =
          upper(btrim(invite_code_ignicion))
    )
  );


alter table public.coaches_profile
  drop constraint if exists
    coaches_profile_invite_evolucion_normalized_chk;

alter table public.coaches_profile
  add constraint
    coaches_profile_invite_evolucion_normalized_chk
  check (
    invite_code_evolucion is null
    or (
      invite_code_evolucion <> ''
      and invite_code_evolucion =
          upper(btrim(invite_code_evolucion))
    )
  );


alter table public.coaches_profile
  drop constraint if exists
    coaches_profile_invite_elite_normalized_chk;

alter table public.coaches_profile
  add constraint
    coaches_profile_invite_elite_normalized_chk
  check (
    invite_code_elite is null
    or (
      invite_code_elite <> ''
      and invite_code_elite =
          upper(btrim(invite_code_elite))
    )
  );


-- ============================================================
-- 5. REGISTRY SYNCHRONIZATION FUNCTION
--
-- SECURITY DEFINER is intentional:
-- authenticated clients never receive access to the private
-- registry, but trusted writes to coaches_profile must be able
-- to keep the registry synchronized.
-- ============================================================

create or replace function private.sync_coach_invite_registry()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin

  -- Row-level locking on coaches_profile serializes concurrent
  -- modifications of the same Coach.
  --
  -- The PRIMARY KEY on normalized_code serializes collisions
  -- between DIFFERENT Coaches.

  delete from private.coach_invite_registry r
  where r.coach_id = new.id;


  begin

    insert into private.coach_invite_registry (
      normalized_code,
      coach_id,
      invite_plan
    )

    select
      x.normalized_code,
      new.id,
      x.invite_plan

    from (
      values

        (
          new.invite_code_ignicion,
          'IGNICION'::text
        ),

        (
          new.invite_code_evolucion,
          'EVOLUCION'::text
        ),

        (
          new.invite_code_elite,
          'ELITE'::text
        )

    ) as x(
      normalized_code,
      invite_plan
    )

    where x.normalized_code is not null;


  exception
    when unique_violation then

      raise exception
        'GENESIS_INVITE: global invite code collision'
        using errcode = '23505';

  end;


  return new;

end;
$function$;


revoke all
on function private.sync_coach_invite_registry()
from public, anon, authenticated;


drop trigger if exists
  trg_90_sync_coach_invite_registry
on public.coaches_profile;


create trigger
  trg_90_sync_coach_invite_registry

after insert
or update of
  invite_code_ignicion,
  invite_code_evolucion,
  invite_code_elite

on public.coaches_profile

for each row

execute function private.sync_coach_invite_registry();


-- ============================================================
-- 6. INITIAL REGISTRY BACKFILL
--
-- Current integrity audit already confirmed:
-- duplicate normalized global codes = 0.
--
-- We still allow the PRIMARY KEY to be the final authority.
-- ============================================================

delete from private.coach_invite_registry;


insert into private.coach_invite_registry (
  normalized_code,
  coach_id,
  invite_plan
)

select
  upper(btrim(c.invite_code_ignicion)),
  c.id,
  'IGNICION'

from public.coaches_profile c

where nullif(
  upper(btrim(c.invite_code_ignicion)),
  ''
) is not null


union all


select
  upper(btrim(c.invite_code_evolucion)),
  c.id,
  'EVOLUCION'

from public.coaches_profile c

where nullif(
  upper(btrim(c.invite_code_evolucion)),
  ''
) is not null


union all


select
  upper(btrim(c.invite_code_elite)),
  c.id,
  'ELITE'

from public.coaches_profile c

where nullif(
  upper(btrim(c.invite_code_elite)),
  ''
) is not null;


-- ============================================================
-- 7. FINAL CLIENT EXECUTION BOUNDARY
-- ============================================================

revoke all
on table private.coach_invite_registry
from public, anon, authenticated;

revoke all
on function private.normalize_coach_invite_code(text)
from public, anon, authenticated;

revoke all
on function private.normalize_coach_invite_codes()
from public, anon, authenticated;

revoke all
on function private.sync_coach_invite_registry()
from public, anon, authenticated;