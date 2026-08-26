-- Genesis OS 002B5.A2C1
-- Canonical PUBLIC branding storage separated from PRIVATE athlete evidence.
--
-- IMPORTANT:
-- Policies on storage.objects are installed through Supabase Storage Studio
-- because hosted Storage owns that table with supabase_storage_admin.

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


create or replace function private.can_manage_genesis_brand_asset(
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
  v_coach_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  -- Only ACTIVE Genesis accounts may manage branding.
  if not exists (
    select 1
    from public.users_master um
    where um.id = v_uid
      and um.account_status::text = 'ACTIVE'
  ) then
    return false;
  end if;

  -- SuperAdmin may manage global branding and all coach branding.
  if private.is_super_admin() then
    return
      p_name like 'global/%'
      or p_name like 'coaches/%';
  end if;

  -- Coach must be ELITE and may manage only:
  -- coaches/<own coach_profile.id>/...
  select cp.id
    into v_coach_id
  from public.coaches_profile cp
  where cp.user_id = v_uid
    and cp.b2b_plan::text = 'ELITE'
  limit 1;

  if v_coach_id is null then
    return false;
  end if;

  return p_name like (
    'coaches/' ||
    v_coach_id::text ||
    '/%'
  );
end;
$$;


revoke all
on function private.can_manage_genesis_brand_asset(text)
from public, anon;

grant execute
on function private.can_manage_genesis_brand_asset(text)
to authenticated;


comment on function private.can_manage_genesis_brand_asset(text) is
'Genesis 002B5.A2C1: authorizes ACTIVE SuperAdmin branding paths or ACTIVE ELITE Coach own coaches/<coach_id>/ branding path.';