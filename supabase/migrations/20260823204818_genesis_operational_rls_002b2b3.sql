-- Genesis OS 002B2B.3
-- Tighten admin_requests, system_notifications and global_announcements.

create or replace function private.can_read_global_announcement(p_target_audience text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  if private.is_super_admin() then
    return true;
  end if;

  v_role := private.current_user_role();

  if p_target_audience = 'ALL' then
    return true;
  end if;

  if p_target_audience = 'COACHES' then
    return v_role = 'COACH';
  end if;

  if p_target_audience = 'ATHLETES' then
    return v_role = 'ATHLETE';
  end if;

  if p_target_audience = 'ELITE_ONLY' then
    if v_role = 'COACH' then
      return exists (
        select 1
        from public.coaches_profile cp
        where cp.user_id = v_uid
          and cp.b2b_plan = 'ELITE'
      );
    end if;

    if v_role = 'ATHLETE' then
      return exists (
        select 1
        from public.athletes_profile ap
        where ap.user_id = v_uid
          and ap.b2c_plan = 'ELITE'
      );
    end if;
  end if;

  return false;
end;
$$;

revoke all on function private.can_read_global_announcement(text) from public, anon;
grant execute on function private.can_read_global_announcement(text) to authenticated;

drop policy if exists "Acceso total admin_requests" on public.admin_requests;

create policy admin_requests_select_authorized
on public.admin_requests
for select
to authenticated
using (
  private.is_super_admin()
  or coach_id = private.current_coach_profile_id()
);

create policy admin_requests_insert_authorized
on public.admin_requests
for insert
to authenticated
with check (
  private.is_super_admin()
  or (
    private.current_user_role() = 'COACH'
    and coach_id = private.current_coach_profile_id()
    and status = 'PENDING'
    and (requested_plan is null or requested_plan in ('IGNICION','EVOLUCION','ELITE'))
  )
);

create policy admin_requests_update_super_admin
on public.admin_requests
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy admin_requests_delete_super_admin
on public.admin_requests
for delete
to authenticated
using (private.is_super_admin());

revoke all on table public.admin_requests from anon, authenticated;
grant select, insert, update, delete on table public.admin_requests to authenticated;

drop policy if exists "Acceso total system_notifications" on public.system_notifications;
drop policy if exists "Lectura Notificaciones" on public.system_notifications;

create policy system_notifications_select_recipient
on public.system_notifications
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  or private.is_super_admin()
);

create policy system_notifications_update_recipient
on public.system_notifications
for update
to authenticated
using (
  recipient_id = (select auth.uid())
  or private.is_super_admin()
)
with check (
  recipient_id = (select auth.uid())
  or private.is_super_admin()
);

create policy system_notifications_delete_recipient
on public.system_notifications
for delete
to authenticated
using (
  recipient_id = (select auth.uid())
  or private.is_super_admin()
);

revoke all on table public.system_notifications from anon, authenticated;
grant select, delete on table public.system_notifications to authenticated;
grant update (read) on table public.system_notifications to authenticated;

drop policy if exists "Acceso total global_announcements" on public.global_announcements;
drop policy if exists "Lectura Anuncios" on public.global_announcements;
drop policy if exists "Lectura libre de anuncios activos" on public.global_announcements;
drop policy if exists "Super Admin gestiona anuncios" on public.global_announcements;

create policy global_announcements_select_authorized
on public.global_announcements
for select
to authenticated
using (
  private.is_super_admin()
  or (
    is_active = true
    and private.can_read_global_announcement(target_audience)
  )
);

create policy global_announcements_insert_super_admin
on public.global_announcements
for insert
to authenticated
with check (
  private.is_super_admin()
  and created_by = (select auth.uid())
);

create policy global_announcements_update_super_admin
on public.global_announcements
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy global_announcements_delete_super_admin
on public.global_announcements
for delete
to authenticated
using (private.is_super_admin());

revoke all on table public.global_announcements from anon, authenticated;
grant select, insert, update, delete on table public.global_announcements to authenticated;
