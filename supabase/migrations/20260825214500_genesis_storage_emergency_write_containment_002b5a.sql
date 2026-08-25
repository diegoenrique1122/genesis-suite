-- Genesis OS 002B5.A1
-- Emergency Storage write containment.
--
-- GOALS:
--   1) Remove the catastrophic global ALL policy on storage.objects.
--   2) Remove anonymous/public INSERT authority from every known bucket.
--   3) Preserve current authenticated upload flows temporarily so production
--      does not break while evidence URLs are migrated away from public access.
--   4) Do NOT change bucket public/private flags yet. That is handled in A2.
--
-- IMPORTANT:
--   This migration is containment, not the final Storage architecture.
--   Public evidence reads remain intentionally unchanged until signed-URL
--   support and stored-path migration are completed.

-- ============================================================================
-- REMOVE GLOBAL WRITE AUTHORITY
-- ============================================================================

drop policy if exists "Acceso Publico Storage"
on storage.objects;

-- ============================================================================
-- REMOVE LEGACY PUBLIC / ANONYMOUS INSERT POLICIES
-- ============================================================================

drop policy if exists "Coaches suben insignias"
on storage.objects;

drop policy if exists "Permitir subidas de fotos progreso"
on storage.objects;

drop policy if exists "Permitir subidas de logos"
on storage.objects;

drop policy if exists "Permitir subidas publicas"
on storage.objects;

drop policy if exists "Subida libre evidencia"
on storage.objects;

-- ============================================================================
-- TEMPORARY AUTHENTICATED INSERT POLICIES
--
-- These preserve existing authenticated application flows while removing
-- anonymous uploads. Ownership/role/path hardening is completed in 002B5.A2/A3.
-- ============================================================================

drop policy if exists storage_athlete_evidence_insert_authenticated
on storage.objects;

create policy storage_athlete_evidence_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'athlete_evidence'
);

-- coach_logos already has an authenticated INSERT policy in the live project.
-- Keep it untouched here to avoid duplicate policy behavior.

drop policy if exists storage_badges_insert_authenticated
on storage.objects;

create policy storage_badges_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'badges'
);

drop policy if exists storage_progress_photos_insert_authenticated
on storage.objects;

create policy storage_progress_photos_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'progress_photos'
);

drop policy if exists storage_logos_insert_authenticated
on storage.objects;

create policy storage_logos_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'logos'
);

drop policy if exists storage_evidencia_insert_authenticated
on storage.objects;

create policy storage_evidencia_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'evidencia'
);

comment on policy storage_athlete_evidence_insert_authenticated
on storage.objects is
'Genesis 002B5.A1 transitional containment: authenticated uploads only. Final athlete ownership/path authorization follows in 002B5.A2.';
