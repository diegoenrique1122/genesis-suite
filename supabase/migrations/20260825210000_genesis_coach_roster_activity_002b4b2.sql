-- Genesis OS 002B4.B.4B2A
-- Canonical Coach roster activity summary.
--
-- Goals:
--   1) Avoid N+1 browser queries for coach rosters.
--   2) Return exactly one summary row per assigned athlete.
--   3) Keep manual discipline and wearable telemetry separate.
--   4) Never invent or derive an adherence score in the browser.
--
-- SECURITY:
--   - Caller identity is derived only from auth.uid().
--   - No athlete/coach ids are accepted from the browser.
--   - Only ACTIVE authenticated coaches receive rows.
--   - SECURITY DEFINER is safe here because the function scopes rows to the
--     caller's own coaches_profile id before reading protected tables.

-- ============================================================================
-- SUPPORTING INDEX
-- ============================================================================

create index if not exists idx_athlete_daily_metrics_athlete_date
on public.athlete_daily_metrics (athlete_id, date desc);

-- daily_logs already has a unique btree on (user_id, log_date), which supports
-- the latest-log lateral lookup efficiently in either scan direction.

-- ============================================================================
-- COACH ROSTER ACTIVITY RPC
-- ============================================================================

create or replace function public.get_coach_roster_activity()
returns table (
  athlete_id uuid,
  athlete_user_id uuid,
  last_manual_date date,
  manual_compliance_score numeric,
  last_wearable_date date
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with current_coach as (
    select cp.id as coach_id
    from public.coaches_profile cp
    join public.users_master um
      on um.id = cp.user_id
    where cp.user_id = auth.uid()
      and um.account_status::text = 'ACTIVE'
    limit 1
  )
  select
    ap.id as athlete_id,
    ap.user_id as athlete_user_id,
    manual.log_date as last_manual_date,
    manual.compliance_score::numeric as manual_compliance_score,
    wearable.date as last_wearable_date
  from public.athletes_profile ap
  join current_coach cc
    on cc.coach_id = ap.coach_id
  left join lateral (
    select
      dl.log_date,
      dl.compliance_score
    from public.daily_logs dl
    where dl.user_id = ap.user_id
      and dl.habits_data ->> 'source' = 'MANUAL_DISCIPLINE'
    order by dl.log_date desc
    limit 1
  ) manual on true
  left join lateral (
    select adm.date
    from public.athlete_daily_metrics adm
    where adm.athlete_id = ap.id
    order by adm.date desc
    limit 1
  ) wearable on true
  where ap.user_id is distinct from auth.uid()
  order by ap.created_at desc;
$$;

revoke all on function public.get_coach_roster_activity()
from public, anon;

grant execute on function public.get_coach_roster_activity()
to authenticated;

comment on function public.get_coach_roster_activity() is
'Genesis 002B4.B.4B2A: returns one canonical activity summary row per athlete assigned to the ACTIVE authenticated coach. Manual daily_logs and wearable athlete_daily_metrics remain separate; no adherence score is derived.';
