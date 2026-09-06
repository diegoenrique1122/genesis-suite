begin;

-- These legacy privileged RPCs are implementation details behind the
-- genesis_athlete_* Edge Function wrappers. They must not be callable
-- directly through the public Data API.
revoke execute
  on function public.resolve_coach_invite(text)
  from public, anon, authenticated;

revoke execute
  on function public.complete_athlete_onboarding(
    text, text, integer, numeric, numeric, text, text, text,
    text, text, text, boolean
  )
  from public, anon, authenticated;

revoke execute
  on function public.evaluate_athlete_badges(uuid)
  from public, anon, authenticated;

commit;