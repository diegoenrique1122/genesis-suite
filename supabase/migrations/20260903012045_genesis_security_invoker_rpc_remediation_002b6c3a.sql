-- 002B6.C.3.A — Execute browser RPCs under the caller's RLS identity.
--
-- These two RPCs only need permissions already granted to their authenticated
-- callers. SECURITY INVOKER removes unnecessary privilege elevation while the
-- explicit grants keep the browser API surface unchanged.

do $preconditions$
declare
  v_function record;
  v_oid oid;
begin
  for v_function in
    select *
    from (
      values
        ('public.get_coach_roster_activity()', 'get_coach_roster_activity'),
        ('public.save_daily_discipline_checkin(jsonb)', 'save_daily_discipline_checkin')
    ) as functions(signature, function_name)
  loop
    v_oid := to_regprocedure(v_function.signature);

    if v_oid is null then
      raise exception
        'GENESIS_C3A_FUNCTION_MISSING: %',
        v_function.function_name;
    end if;

    if not (
      select function_definition.prosecdef
      from pg_catalog.pg_proc as function_definition
      where function_definition.oid = v_oid
    ) then
      raise exception
        'GENESIS_C3A_EXPECTED_SECURITY_DEFINER: %',
        v_function.function_name;
    end if;
  end loop;
end;
$preconditions$;

alter function public.get_coach_roster_activity()
  security invoker;

alter function public.get_coach_roster_activity()
  set search_path = '';

revoke all
  on function public.get_coach_roster_activity()
  from public, anon, authenticated;

grant execute
  on function public.get_coach_roster_activity()
  to authenticated;

alter function public.save_daily_discipline_checkin(jsonb)
  security invoker;

alter function public.save_daily_discipline_checkin(jsonb)
  set search_path = '';

revoke all
  on function public.save_daily_discipline_checkin(jsonb)
  from public, anon, authenticated;

grant execute
  on function public.save_daily_discipline_checkin(jsonb)
  to authenticated;

do $postconditions$
declare
  v_function record;
  v_oid oid;
  v_security_definer boolean;
  v_search_path_is_empty boolean;
  v_public_execute boolean;
begin
  for v_function in
    select *
    from (
      values
        ('public.get_coach_roster_activity()', 'get_coach_roster_activity'),
        ('public.save_daily_discipline_checkin(jsonb)', 'save_daily_discipline_checkin')
    ) as functions(signature, function_name)
  loop
    v_oid := to_regprocedure(v_function.signature);

    if v_oid is null then
      raise exception
        'GENESIS_C3A_POSTCONDITION_FUNCTION_MISSING: %',
        v_function.function_name;
    end if;

    select
      function_definition.prosecdef,
      coalesce(
        function_definition.proconfig @> array['search_path=""']::text[],
        false
      )
    into
      v_security_definer,
      v_search_path_is_empty
    from pg_catalog.pg_proc as function_definition
    where function_definition.oid = v_oid;

    if v_security_definer then
      raise exception
        'GENESIS_C3A_SECURITY_INVOKER_NOT_ENFORCED: %',
        v_function.function_name;
    end if;

    if not v_search_path_is_empty then
      raise exception
        'GENESIS_C3A_EMPTY_SEARCH_PATH_NOT_ENFORCED: %',
        v_function.function_name;
    end if;

    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception
        'GENESIS_C3A_AUTHENTICATED_EXECUTE_MISSING: %',
        v_function.function_name;
    end if;

    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception
        'GENESIS_C3A_ANON_EXECUTE_REMAINS: %',
        v_function.function_name;
    end if;

    select exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          function_definition.proacl,
          pg_catalog.acldefault('f', function_definition.proowner)
        )
      ) as privilege_row
      where privilege_row.grantee = 0
        and privilege_row.privilege_type = 'EXECUTE'
    )
    into v_public_execute
    from pg_catalog.pg_proc as function_definition
    where function_definition.oid = v_oid;

    if v_public_execute then
      raise exception
        'GENESIS_C3A_PUBLIC_EXECUTE_REMAINS: %',
        v_function.function_name;
    end if;
  end loop;
end;
$postconditions$;

comment on function public.get_coach_roster_activity() is
  'Returns the authenticated coach roster under caller RLS; SECURITY INVOKER is required.';

comment on function public.save_daily_discipline_checkin(jsonb) is
  'Persists the authenticated athlete check-in under caller RLS; SECURITY INVOKER is required.';
