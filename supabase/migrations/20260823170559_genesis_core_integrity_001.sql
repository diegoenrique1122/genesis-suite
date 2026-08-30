create schema if not exists private;

-- 1) b2b_plan is the operational source during the compatibility window.
alter table public.coaches_profile
  alter column b2b_plan set default 'IGNICION'::text;

update public.coaches_profile
set subscription_tier = b2b_plan::public.b2b_tier
where b2b_plan in ('IGNICION','EVOLUCION','ELITE')
  and subscription_tier::text is distinct from b2b_plan;

alter table public.coaches_profile
  add constraint coaches_profile_b2b_plan_check
  check (b2b_plan in ('IGNICION','EVOLUCION','ELITE'));

alter table public.athletes_profile
  add constraint athletes_profile_b2c_plan_check
  check (b2c_plan in ('IGNICION','EVOLUCION','ELITE'));

create or replace function private.sync_coach_plan_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.b2b_plan is null then
      new.b2b_plan := coalesce(new.subscription_tier::text, 'IGNICION');
    end if;
    new.subscription_tier := new.b2b_plan::public.b2b_tier;
  elsif new.b2b_plan is distinct from old.b2b_plan then
    new.subscription_tier := new.b2b_plan::public.b2b_tier;
  elsif new.subscription_tier is distinct from old.subscription_tier then
    new.b2b_plan := new.subscription_tier::text;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_coach_plan_fields() from public;

drop trigger if exists trg_sync_coach_plan_fields on public.coaches_profile;
create trigger trg_sync_coach_plan_fields
before insert or update of b2b_plan, subscription_tier
on public.coaches_profile
for each row
execute function private.sync_coach_plan_fields();

-- 2) Complete badge referential integrity.
alter table public.athlete_earned_badges
  add constraint athlete_earned_badges_badge_id_fkey
  foreign key (badge_id)
  references public.badges_dictionary(id)
  on delete cascade;

-- 3) Index common ownership / RLS / dashboard access paths.
create index if not exists athletes_profile_coach_id_idx
  on public.athletes_profile (coach_id);
create index if not exists athlete_photos_coach_id_idx
  on public.athlete_photos (coach_id);
create index if not exists badges_dictionary_coach_id_idx
  on public.badges_dictionary (coach_id);
create index if not exists athlete_earned_badges_badge_id_idx
  on public.athlete_earned_badges (badge_id);
create index if not exists admin_requests_coach_id_idx
  on public.admin_requests (coach_id);
create index if not exists chat_groups_coach_id_idx
  on public.chat_groups (coach_id);
create index if not exists community_messages_coach_id_idx
  on public.community_messages (coach_id);
create index if not exists chat_messages_sender_id_idx
  on public.chat_messages (sender_id);
create index if not exists chat_messages_recipient_id_idx
  on public.chat_messages (recipient_id);
create index if not exists chat_messages_user_coach_id_idx
  on public.chat_messages (user_coach_id);
create index if not exists system_notifications_recipient_id_idx
  on public.system_notifications (recipient_id);

-- 4) Safe invite-code resolver. It returns only the minimum data required by onboarding.
create or replace function public.resolve_coach_invite(p_code text)
returns table (
  coach_id uuid,
  coach_name text,
  athlete_plan text
)
language sql
stable
security definer
set search_path = ''
as $$
  with matched as (
    select
      c.id,
      c.full_name,
      c.b2b_plan,
      case
        when upper(c.invite_code_ignicion) = upper(trim(p_code)) then 'IGNICION'
        when upper(c.invite_code_evolucion) = upper(trim(p_code)) then 'EVOLUCION'
        when upper(c.invite_code_elite) = upper(trim(p_code)) then 'ELITE'
        else null
      end as requested_plan
    from public.coaches_profile c
    join public.users_master u on u.id = c.user_id
    where (select auth.uid()) is not null
      and u.account_status = 'ACTIVE'::public.account_status
      and upper(trim(p_code)) in (
        upper(coalesce(c.invite_code_ignicion, '')),
        upper(coalesce(c.invite_code_evolucion, '')),
        upper(coalesce(c.invite_code_elite, ''))
      )
    limit 1
  )
  select
    id as coach_id,
    full_name as coach_name,
    requested_plan as athlete_plan
  from matched
  where requested_plan in ('IGNICION','EVOLUCION')
     or (requested_plan = 'ELITE' and b2b_plan in ('EVOLUCION','ELITE'));
$$;

revoke all on function public.resolve_coach_invite(text) from public;
revoke all on function public.resolve_coach_invite(text) from anon;
grant execute on function public.resolve_coach_invite(text) to authenticated;;
