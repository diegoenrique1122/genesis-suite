-- Genesis OS 002B5.A2E.1
-- Retire public exposure from legacy Storage buckets.
--
-- Audit completed before containment:
-- - no active runtime Storage references
-- - no persisted DB references to legacy objects
-- - objects intentionally preserved for final retirement audit
--
-- This migration does NOT delete buckets or objects.

update storage.buckets
set public = false
where id in (
  'badges',
  'coach_logos',
  'evidencia',
  'logos',
  'progress_photos'
);