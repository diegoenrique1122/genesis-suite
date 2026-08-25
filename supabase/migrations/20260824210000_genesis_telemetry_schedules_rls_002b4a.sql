-- Genesis OS 002B4.A
-- Secure athlete telemetry, schedules and canonical daily logs.
-- The target tables are empty at the time of this migration, so legacy identity
-- dependencies can be corrected without data transformation.

-- ============================================================
-- CANONICAL ATHLETE IDENTITY HELPERS
-- ============================================================

create or replace function private.current_athlete_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select ap.id
  from public.athletes_profile ap
  join public.users_master um
    on um.id = ap.user_id
  where ap.user_id = auth.uid()
    and um.account_status::text = 'ACTIVE'
  limit 1;
$$;

revoke all on function private.current_athlete_profile_id() from public, anon;
grant execute on function private.current_athlete_profile_id() to authenticated;

create or replace function private.can_read_athlete_user_data(p_target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null or p_target_user_id is null then
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

  if p_target_user_id = v_uid then
    return exists (
      select 1
      from public.athletes_profile ap
      where ap.user_id = v_uid
    );
  end if;

  return exists (
    select 1
    from public.athletes_profile ap
    where ap.user_id = p_target_user_id
      and private.is_assigned_coach(ap.id)
  );
end;
$$;

revoke all on function private.can_read_athlete_user_data(uuid) from public, anon;
grant execute on function private.can_read_athlete_user_data(uuid) to authenticated;

-- ============================================================
-- DEFENSE-IN-DEPTH WRITE GUARDS
-- ============================================================

create or replace function private.guard_athlete_owned_row_write()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_athlete_id uuid;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if private.is_super_admin() then
    return new;
  end if;

  v_athlete_id := private.current_athlete_profile_id();

  if v_athlete_id is null then
    raise exception 'GENESIS_DATA: active athlete identity required';
  end if;

  if tg_op = 'INSERT' then
    -- Never trust an athlete_id supplied by the browser.
    new.athlete_id := v_athlete_id;
    return new;
  end if;

  if old.athlete_id is distinct from v_athlete_id
     or new.athlete_id is distinct from old.athlete_id
  then
    raise exception 'GENESIS_DATA: athlete_id cannot be changed or spoofed';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_athlete_owned_row_write() from public, anon;

create or replace function private.guard_daily_log_write()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_athlete_id uuid;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if private.is_super_admin() then
    return new;
  end if;

  v_uid := auth.uid();
  v_athlete_id := private.current_athlete_profile_id();

  if v_uid is null or v_athlete_id is null then
    raise exception 'GENESIS_DATA: active athlete identity required';
  end if;

  if tg_op = 'INSERT' then
    -- Canonicalize browser input to the authenticated athlete identity.
    new.user_id := v_uid;
    return new;
  end if;

  if old.user_id is distinct from v_uid
     or new.user_id is distinct from old.user_id
  then
    raise exception 'GENESIS_DATA: daily log identity cannot be changed or spoofed';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_daily_log_write() from public, anon;

-- ============================================================
-- ATHLETE DAILY METRICS
-- ============================================================

alter table public.athlete_daily_metrics enable row level security;

-- Missing wearable values must remain NULL, not synthetic zeroes. The Auditor IA
-- can then distinguish "no data" from a real measured value.
alter table public.athlete_daily_metrics
  alter column steps drop default,
  alter column sleep_hours drop default,
  alter column hrv drop default,
  alter column rhr drop default;

alter table public.athlete_daily_metrics
  drop constraint if exists athlete_daily_metrics_steps_check,
  drop constraint if exists athlete_daily_metrics_sleep_hours_check,
  drop constraint if exists athlete_daily_metrics_hrv_check,
  drop constraint if exists athlete_daily_metrics_rhr_check;

alter table public.athlete_daily_metrics
  add constraint athlete_daily_metrics_steps_check
    check (steps is null or (steps >= 0 and steps <= 200000)),
  add constraint athlete_daily_metrics_sleep_hours_check
    check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  add constraint athlete_daily_metrics_hrv_check
    check (hrv is null or (hrv >= 0 and hrv <= 500)),
  add constraint athlete_daily_metrics_rhr_check
    check (rhr is null or (rhr >= 20 and rhr <= 250));

drop policy if exists "Atletas leen y escriben sus métricas" on public.athlete_daily_metrics;
drop policy if exists "Coaches leen métricas de sus atletas" on public.athlete_daily_metrics;
drop policy if exists athlete_daily_metrics_select_authorized on public.athlete_daily_metrics;
drop policy if exists athlete_daily_metrics_insert_self on public.athlete_daily_metrics;
drop policy if exists athlete_daily_metrics_update_self on public.athlete_daily_metrics;
drop policy if exists athlete_daily_metrics_delete_super_admin on public.athlete_daily_metrics;

create policy athlete_daily_metrics_select_authorized
on public.athlete_daily_metrics
for select
to authenticated
using (private.can_read_athlete_profile(athlete_id));

create policy athlete_daily_metrics_insert_self
on public.athlete_daily_metrics
for insert
to authenticated
with check (
  private.is_super_admin()
  or athlete_id = private.current_athlete_profile_id()
);

create policy athlete_daily_metrics_update_self
on public.athlete_daily_metrics
for update
to authenticated
using (
  private.is_super_admin()
  or athlete_id = private.current_athlete_profile_id()
)
with check (
  private.is_super_admin()
  or athlete_id = private.current_athlete_profile_id()
);

create policy athlete_daily_metrics_delete_super_admin
on public.athlete_daily_metrics
for delete
to authenticated
using (private.is_super_admin());

drop trigger if exists trg_guard_athlete_daily_metrics_write
on public.athlete_daily_metrics;

create trigger trg_guard_athlete_daily_metrics_write
before insert or update on public.athlete_daily_metrics
for each row
execute function private.guard_athlete_owned_row_write();

revoke all on table public.athlete_daily_metrics from anon, authenticated;
grant select, insert, update, delete on table public.athlete_daily_metrics to authenticated;

-- ============================================================
-- ATHLETE SCHEDULES
-- ============================================================

alter table public.athlete_schedules enable row level security;

-- There is exactly one schedule per athlete; an unowned schedule has no meaning.
alter table public.athlete_schedules
  alter column athlete_id set not null;

drop policy if exists "Atletas y Coaches leen horarios" on public.athlete_schedules;
drop policy if exists "Atletas_Insertan_Horarios" on public.athlete_schedules;
drop policy if exists "Coaches_Leen_Horarios" on public.athlete_schedules;
drop policy if exists athlete_schedules_select_authorized on public.athlete_schedules;
drop policy if exists athlete_schedules_insert_self on public.athlete_schedules;
drop policy if exists athlete_schedules_update_self on public.athlete_schedules;
drop policy if exists athlete_schedules_delete_super_admin on public.athlete_schedules;

create policy athlete_schedules_select_authorized
on public.athlete_schedules
for select
to authenticated
using (private.can_read_athlete_profile(athlete_id));

create policy athlete_schedules_insert_self
on public.athlete_schedules
for insert
to authenticated
with check (
  private.is_super_admin()
  or athlete_id = private.current_athlete_profile_id()
);

create policy athlete_schedules_update_self
on public.athlete_schedules
for update
to authenticated
using (
  private.is_super_admin()
  or athlete_id = private.current_athlete_profile_id()
)
with check (
  private.is_super_admin()
  or athlete_id = private.current_athlete_profile_id()
);

create policy athlete_schedules_delete_super_admin
on public.athlete_schedules
for delete
to authenticated
using (private.is_super_admin());

drop trigger if exists trg_guard_athlete_schedules_write
on public.athlete_schedules;

create trigger trg_guard_athlete_schedules_write
before insert or update on public.athlete_schedules
for each row
execute function private.guard_athlete_owned_row_write();

revoke all on table public.athlete_schedules from anon, authenticated;
grant select, insert, update, delete on table public.athlete_schedules to authenticated;

-- ============================================================
-- DAILY LOGS: RETIRE LEGACY profiles(id) IDENTITY
-- ============================================================

alter table public.daily_logs enable row level security;

-- profiles is empty and is not the Genesis identity authority. daily_logs.user_id
-- is an authenticated Genesis user id, so anchor it to users_master instead.
alter table public.daily_logs
  drop constraint if exists daily_logs_user_id_fkey,
  drop constraint if exists daily_logs_user_id_log_date_key;

alter table public.daily_logs
  alter column user_id set not null;

alter table public.daily_logs
  add constraint daily_logs_user_id_fkey
    foreign key (user_id)
    references public.users_master(id)
    on delete cascade,
  add constraint daily_logs_user_id_log_date_key
    unique (user_id, log_date);

alter table public.daily_logs
  drop constraint if exists daily_logs_compliance_score_check;

alter table public.daily_logs
  add constraint daily_logs_compliance_score_check
    check (
      compliance_score is null
      or (compliance_score >= 0 and compliance_score <= 100)
    );

drop policy if exists "Desarrollo_Logs" on public.daily_logs;
drop policy if exists daily_logs_select_authorized on public.daily_logs;
drop policy if exists daily_logs_insert_self on public.daily_logs;
drop policy if exists daily_logs_update_self on public.daily_logs;
drop policy if exists daily_logs_delete_super_admin on public.daily_logs;

create policy daily_logs_select_authorized
on public.daily_logs
for select
to authenticated
using (private.can_read_athlete_user_data(user_id));

create policy daily_logs_insert_self
on public.daily_logs
for insert
to authenticated
with check (
  private.is_super_admin()
  or user_id = (select auth.uid())
);

create policy daily_logs_update_self
on public.daily_logs
for update
to authenticated
using (
  private.is_super_admin()
  or user_id = (select auth.uid())
)
with check (
  private.is_super_admin()
  or user_id = (select auth.uid())
);

create policy daily_logs_delete_super_admin
on public.daily_logs
for delete
to authenticated
using (private.is_super_admin());

drop trigger if exists trg_guard_daily_logs_write
on public.daily_logs;

create trigger trg_guard_daily_logs_write
before insert or update on public.daily_logs
for each row
execute function private.guard_daily_log_write();

revoke all on table public.daily_logs from anon, authenticated;
grant select, insert, update, delete on table public.daily_logs to authenticated;

-- ============================================================
-- LEGACY profiles: QUARANTINE, DO NOT DROP YET
-- ============================================================

-- No current Genesis records depend on profiles and the table is empty. Keep it
-- for forensic compatibility, but make it unreachable from browser roles.
alter table public.profiles enable row level security;
drop policy if exists "Desarrollo_Profiles" on public.profiles;
revoke all on table public.profiles from anon, authenticated;
