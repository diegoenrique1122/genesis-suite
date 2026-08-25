-- Genesis OS 002B5.A2A
-- Prepare athlete evidence for private access without breaking current public URLs yet.
--
-- GOALS:
--   1) Add canonical storage path columns to athlete_photos.
--   2) Backfill those paths from existing athlete_evidence public URLs.
--   3) Add path-aware authorization helpers for athlete evidence.
--   4) Harden authenticated uploads so users cannot write into another athlete's path.
--   5) Add authenticated SELECT policy required for future signed URLs.
--   6) Keep athlete_evidence bucket PUBLIC for this transition only.
--
-- IMPORTANT:
--   This migration does NOT flip athlete_evidence to private.
--   Branding objects under logos/ and assets/ still depend on public URLs and
--   must be moved before the final private cutover.

-- ============================================================================
-- ATHLETE_PHOTOS: CANONICAL STORAGE PATHS
-- ============================================================================

alter table public.athlete_photos
  add column if not exists front_path text,
  add column if not exists side_path text,
  add column if not exists back_path text;

update public.athlete_photos
set front_path = split_part(
  front_url,
  '/storage/v1/object/public/athlete_evidence/',
  2
)
where front_path is null
  and front_url like '%/storage/v1/object/public/athlete_evidence/%';

update public.athlete_photos
set side_path = split_part(
  side_url,
  '/storage/v1/object/public/athlete_evidence/',
  2
)
where side_path is null
  and side_url like '%/storage/v1/object/public/athlete_evidence/%';

update public.athlete_photos
set back_path = split_part(
  back_url,
  '/storage/v1/object/public/athlete_evidence/',
  2
)
where back_path is null
  and back_url like '%/storage/v1/object/public/athlete_evidence/%';

-- ============================================================================
-- PATH PARSER
-- Supports both current canonical folders:
--   <athlete_id>/week_1/...
--   <athlete_id>/daily_meals/...
-- and legacy active objects:
--   progress_photos/<athlete_id>_week0_front_....jpg
-- ============================================================================

create or replace function private.athlete_id_from_evidence_object_name(
  p_name text
)
returns uuid
language plpgsql
immutable
set search_path = public, private, pg_temp
as $$
declare
  v_candidate text;
begin
  if p_name is null or btrim(p_name) = '' then
    return null;
  end if;

  -- Canonical path: first directory is athlete_profile.id.
  v_candidate := split_part(p_name, '/', 1);

  if v_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_candidate::uuid;
  end if;

  -- Legacy progress path: progress_photos/<uuid>_week...
  if p_name like 'progress_photos/%' then
    v_candidate := substring(
      split_part(p_name, '/', 2)
      from 1 for 36
    );

    if v_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return v_candidate::uuid;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.athlete_id_from_evidence_object_name(text)
from public, anon;

grant execute on function private.athlete_id_from_evidence_object_name(text)
to authenticated;

-- ============================================================================
-- READ AUTHORIZATION FOR PRIVATE EVIDENCE
-- ============================================================================

create or replace function private.can_read_athlete_evidence_object(
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_athlete_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_athlete_id := private.athlete_id_from_evidence_object_name(p_name);

  if v_athlete_id is null then
    return false;
  end if;

  return private.can_read_athlete_profile(v_athlete_id);
end;
$$;

revoke all on function private.can_read_athlete_evidence_object(text)
from public, anon;

grant execute on function private.can_read_athlete_evidence_object(text)
to authenticated;

-- ============================================================================
-- WRITE AUTHORIZATION
-- Athlete: only own athlete path.
-- Coach Elite: only own legacy branding prefix during transition.
-- SuperAdmin: allowed for operational transition paths.
-- ============================================================================

create or replace function private.can_insert_athlete_evidence_object(
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_target_athlete_id uuid;
  v_self_athlete_id uuid;
  v_coach_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.users_master um
    where um.id = v_uid
      and um.account_status::text = 'ACTIVE'
  ) then
    return false;
  end if;

  if private.is_super_admin() then
    return true;
  end if;

  -- Athlete evidence paths.
  v_target_athlete_id := private.athlete_id_from_evidence_object_name(p_name);

  if v_target_athlete_id is not null then
    select ap.id
      into v_self_athlete_id
    from public.athletes_profile ap
    where ap.user_id = v_uid
    limit 1;

    return v_self_athlete_id is not null
      and v_self_athlete_id = v_target_athlete_id;
  end if;

  -- Transitional Coach branding path used by the current frontend:
  -- logos/<coach_profile.id>_<timestamp>.<ext>
  if p_name like 'logos/%' then
    select cp.id
      into v_coach_id
    from public.coaches_profile cp
    where cp.user_id = v_uid
      and cp.b2b_plan::text = 'ELITE'
    limit 1;

    return v_coach_id is not null
      and p_name like ('logos/' || v_coach_id::text || '_%');
  end if;

  -- assets/ is reserved for SuperAdmin, already handled above.
  return false;
end;
$$;

revoke all on function private.can_insert_athlete_evidence_object(text)
from public, anon;

grant execute on function private.can_insert_athlete_evidence_object(text)
to authenticated;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- The bucket is still public in this transition, so public object URLs continue
-- to work. Removing this SELECT policy prepares RLS for the final private cutover.
drop policy if exists "Lectura libre evidencia"
on storage.objects;

drop policy if exists storage_athlete_evidence_select_authorized
on storage.objects;

create policy storage_athlete_evidence_select_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'athlete_evidence'
  and private.can_read_athlete_evidence_object(name)
);

drop policy if exists storage_athlete_evidence_insert_authenticated
on storage.objects;

create policy storage_athlete_evidence_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'athlete_evidence'
  and private.can_insert_athlete_evidence_object(name)
);

-- ============================================================================
-- DEFENSE-IN-DEPTH BUCKET LIMITS
-- Keep common mobile image formats accepted during transition.
-- ============================================================================

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
where id = 'athlete_evidence';

comment on function private.can_read_athlete_evidence_object(text) is
'Genesis 002B5.A2A: authorizes athlete evidence reads through canonical athlete relationships. Supports canonical UUID folders and legacy progress_photos UUID filenames.';

comment on function private.can_insert_athlete_evidence_object(text) is
'Genesis 002B5.A2A: restricts athlete_evidence uploads to the authenticated athlete own path, Elite Coach own transitional logo prefix, or SuperAdmin.';
