-- 002B6.C.2.C — Retire the superseded hard-delete RPC boundary.
--
-- The Edge Function uses only the resumable V2/recovery contract introduced
-- by 002B6.C.2.A. Removing the legacy SECURITY DEFINER entry points prevents
-- stale callers from bypassing the recovery state machine.

do $genesis_c2c_precondition$
begin
  if to_regprocedure(
    'public.genesis_account_lifecycle_begin_hard_delete(uuid,uuid,uuid,text)'
  ) is null then
    raise exception 'GENESIS_C2C_LEGACY_BEGIN_NOT_FOUND';
  end if;

  if to_regprocedure(
    'public.genesis_account_lifecycle_finalize_hard_delete(uuid,uuid,uuid,text)'
  ) is null then
    raise exception 'GENESIS_C2C_LEGACY_FINALIZE_NOT_FOUND';
  end if;
end
$genesis_c2c_precondition$;

drop function public.genesis_account_lifecycle_begin_hard_delete(
  uuid,
  uuid,
  uuid,
  text
);

drop function public.genesis_account_lifecycle_finalize_hard_delete(
  uuid,
  uuid,
  uuid,
  text
);

do $genesis_c2c_postcondition$
begin
  if to_regprocedure(
    'public.genesis_account_lifecycle_begin_hard_delete(uuid,uuid,uuid,text)'
  ) is not null then
    raise exception 'GENESIS_C2C_LEGACY_BEGIN_REMAINS';
  end if;

  if to_regprocedure(
    'public.genesis_account_lifecycle_finalize_hard_delete(uuid,uuid,uuid,text)'
  ) is not null then
    raise exception 'GENESIS_C2C_LEGACY_FINALIZE_REMAINS';
  end if;

  if to_regprocedure(
    'public.genesis_account_lifecycle_begin_hard_delete_v2(uuid,uuid,uuid,text)'
  ) is null then
    raise exception 'GENESIS_C2C_V2_BEGIN_MISSING';
  end if;

  if to_regprocedure(
    'public.genesis_account_lifecycle_claim_hard_delete_recovery(uuid,uuid,uuid,text)'
  ) is null then
    raise exception 'GENESIS_C2C_RECOVERY_CLAIM_MISSING';
  end if;

  if to_regprocedure(
    'public.genesis_account_lifecycle_mark_hard_delete_recovery_required(uuid,uuid,uuid,bigint,text,text,text)'
  ) is null then
    raise exception 'GENESIS_C2C_RECOVERY_MARK_MISSING';
  end if;

  if to_regprocedure(
    'public.genesis_account_lifecycle_finalize_hard_delete_v2(uuid,uuid,uuid,bigint,text)'
  ) is null then
    raise exception 'GENESIS_C2C_V2_FINALIZE_MISSING';
  end if;
end
$genesis_c2c_postcondition$;
