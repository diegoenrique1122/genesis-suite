-- Genesis OS 002B5.A2C1
-- Canonical PUBLIC branding storage, separated from PRIVATE athlete evidence.
--
-- Architecture:
--   genesis_brand_assets (PUBLIC)
--     global/...                 -> Genesis / SuperAdmin watermark assets
--     coaches/<coach_id>/...     -> ELITE coach branding assets
--
-- athlete_evidence remains transitional-public until A2D.
-- This migration does NOT move or delete existing objects.
--
-- IMPORTANT:
-- storage.objects is owned by supabase_storage_admin in hosted Supabase.
-- Project postgres is a member of that role, so policy DDL must temporarily
-- assume the table-owner role. reset role restores the migration caller.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'genesis_brand_assets',
  'genesis_brand_assets',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- PostgreSQL requires CREATE/DROP POLICY to execute as the table owner.
set role supabase_storage_admin;

-- Remove only Genesis-owned policies for this bucket so the migration is rerunnable.
drop policy if exists storage_genesis_brand_assets_insert_authorized
on storage.objects;

drop policy if exists storage_genesis_brand_assets_update_authorized
on storage.objects;

drop policy if exists storage_genesis_brand_assets_delete_authorized
on storage.objects;

-- SuperAdmin may manage the complete public branding bucket.
-- ELITE coaches may create assets only inside coaches/<their coach_profile.id>/...
create policy storage_genesis_brand_assets_insert_authorized
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'genesis_brand_assets'
  and (
    private.is_super_admin()
    or exists (
      select 1
      from public.coaches_profile cp
      where cp.user_id = auth.uid()
        and cp.b2b_plan::text = 'ELITE'
        and name like (
          'coaches/' || cp.id::text || '/%'
        )
    )
  )
);

create policy storage_genesis_brand_assets_update_authorized
on storage.objects
for update
to authenticated
using (
  bucket_id = 'genesis_brand_assets'
  and (
    private.is_super_admin()
    or exists (
      select 1
      from public.coaches_profile cp
      where cp.user_id = auth.uid()
        and cp.b2b_plan::text = 'ELITE'
        and name like (
          'coaches/' || cp.id::text || '/%'
        )
    )
  )
)
with check (
  bucket_id = 'genesis_brand_assets'
  and (
    private.is_super_admin()
    or exists (
      select 1
      from public.coaches_profile cp
      where cp.user_id = auth.uid()
        and cp.b2b_plan::text = 'ELITE'
        and name like (
          'coaches/' || cp.id::text || '/%'
        )
    )
  )
);

create policy storage_genesis_brand_assets_delete_authorized
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'genesis_brand_assets'
  and (
    private.is_super_admin()
    or exists (
      select 1
      from public.coaches_profile cp
      where cp.user_id = auth.uid()
        and cp.b2b_plan::text = 'ELITE'
        and name like (
          'coaches/' || cp.id::text || '/%'
        )
    )
  )
);

reset role;
