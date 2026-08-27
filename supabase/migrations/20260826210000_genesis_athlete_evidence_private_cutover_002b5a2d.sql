-- Genesis OS 002B5.A2D
-- Final private cutover for athlete evidence.
--
-- Preconditions validated:
-- - authenticated-only SELECT policy
-- - authenticated-only INSERT policy
-- - body photos have canonical paths
-- - meal evidence uses canonical photo_path
-- - active Coach logo moved to genesis_brand_assets
-- - active global watermark moved to genesis_brand_assets

update storage.buckets
set public = false
where id = 'athlete_evidence';
