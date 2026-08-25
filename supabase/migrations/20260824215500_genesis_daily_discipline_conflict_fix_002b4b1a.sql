-- Genesis OS 002B4.B.1A
-- Fix PL/pgSQL ambiguity between RETURNS TABLE output column `log_date`
-- and public.daily_logs.log_date inside the UPSERT conflict target.
--
-- Root cause:
--   RETURNS TABLE (log_date date, ...)
-- creates a PL/pgSQL output variable named log_date. Therefore:
--   ON CONFLICT (user_id, log_date)
-- is ambiguous inside the function.
--
-- Canonical fix:
-- target the existing unique constraint explicitly.

do $$
declare
  v_function_def text;
  v_old_fragment text := 'on conflict (user_id, log_date)';
  v_new_fragment text := 'on conflict on constraint daily_logs_user_id_log_date_key';
begin
  if to_regprocedure('public.save_daily_discipline_checkin(jsonb)') is null then
    raise exception 'GENESIS_002B4B1A: save_daily_discipline_checkin(jsonb) does not exist';
  end if;

  select pg_get_functiondef(
    'public.save_daily_discipline_checkin(jsonb)'::regprocedure
  )
  into v_function_def;

  if position(v_old_fragment in lower(v_function_def)) = 0 then
    -- Idempotent success when the function was already corrected.
    if position(v_new_fragment in lower(v_function_def)) > 0 then
      return;
    end if;

    raise exception
      'GENESIS_002B4B1A: expected UPSERT fragment was not found; refusing unsafe rewrite';
  end if;

  v_function_def := replace(
    v_function_def,
    v_old_fragment,
    v_new_fragment
  );

  execute v_function_def;
end;
$$;

-- Preserve the intended RPC privilege boundary after CREATE OR REPLACE.
revoke all on function public.save_daily_discipline_checkin(jsonb)
from public, anon;

grant execute on function public.save_daily_discipline_checkin(jsonb)
to authenticated;

comment on function public.save_daily_discipline_checkin(jsonb) is
'Genesis 002B4.B.1A: canonical daily discipline RPC with unambiguous UPSERT via daily_logs_user_id_log_date_key.';
