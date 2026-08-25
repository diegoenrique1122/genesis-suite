-- Genesis OS 002B4.A1
-- Remove any residual/permissive policies from athlete_daily_metrics
-- and rebuild only the canonical secure policy set.

-- Drop every existing policy on the table so legacy names/hidden spacing
-- cannot survive and combine permissively with the secure policies.
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_daily_metrics'
  loop
    execute format(
      'drop policy if exists %I on public.athlete_daily_metrics',
      r.policyname
    );
  end loop;
end;
$$;

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

-- Keep browser grants intentionally narrow and anon fully revoked.
revoke all on table public.athlete_daily_metrics from anon, authenticated;
grant select, insert, update, delete on table public.athlete_daily_metrics to authenticated;
