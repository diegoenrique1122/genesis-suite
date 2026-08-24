-- Genesis OS 002B2B.4
-- Preserve direct B2B referral visibility without reopening global coach-profile reads.

create or replace function private.can_read_coach_profile(p_coach_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_current_coach_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  if private.is_super_admin() then
    return true;
  end if;

  select cp.id
    into v_current_coach_id
  from public.coaches_profile cp
  where cp.user_id = v_uid
  limit 1;

  if v_current_coach_id = p_coach_profile_id then
    return true;
  end if;

  if v_current_coach_id is not null
     and exists (
       select 1
       from public.coaches_profile target
       where target.id = p_coach_profile_id
         and target.referred_by_coach_id = v_current_coach_id
     )
  then
    return true;
  end if;

  return exists (
    select 1
    from public.athletes_profile ap
    where ap.user_id = v_uid
      and ap.coach_id = p_coach_profile_id
  );
end;
$$;

revoke all on function private.can_read_coach_profile(uuid) from public, anon;
grant execute on function private.can_read_coach_profile(uuid) to authenticated;
