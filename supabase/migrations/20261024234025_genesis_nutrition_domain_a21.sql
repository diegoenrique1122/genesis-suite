-- Genesis A2.1 - Additive nutrition domain foundation
-- Reviewed source baseline: 9b3673c64b5fe8b507d778f8ec9123f635e2aa2b
--
-- Generate the migration filename with the pinned Supabase CLI before copying
-- this payload into supabase/migrations. Do not apply directly to production.
--
-- This foundation adds schema and authorized reads only. It publishes no plan,
-- imports no legacy JSON, changes no profile, and exposes no browser writes.
-- Authoring/review RPCs and the UI cutover are separate checkpoints.

do $preconditions$
begin
  if to_regnamespace('private') is null
     or to_regprocedure('auth.uid()') is null
     or to_regclass('public.users_master') is null
     or to_regclass('public.coaches_profile') is null
     or to_regclass('public.athletes_profile') is null
     or to_regclass('public.athlete_programs') is null
  then
    raise exception 'GENESIS_NUTRITION_FOUNDATION_DEPENDENCY_MISSING';
  end if;
end;
$preconditions$;

create table public.athlete_nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null
    references public.athletes_profile(id) on delete cascade,
  program_id uuid not null unique
    references public.athlete_programs(id) on delete cascade,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index athlete_nutrition_plans_athlete_idx
  on public.athlete_nutrition_plans (athlete_id);

create table public.athlete_nutrition_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null
    references public.athlete_nutrition_plans(id) on delete cascade,
  version_number integer not null check (version_number between 1 and 1000000),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  title text not null check (length(btrim(title)) between 1 and 120),
  time_zone text not null check (length(btrim(time_zone)) between 1 and 100),
  starts_on date,
  ends_on date,
  target_calories_kcal numeric(10,3)
    check (target_calories_kcal between 0 and 1000000),
  target_protein_g numeric(10,3)
    check (target_protein_g between 0 and 1000000),
  target_carbs_g numeric(10,3)
    check (target_carbs_g between 0 and 1000000),
  target_fat_g numeric(10,3)
    check (target_fat_g between 0 and 1000000),
  plan_note text not null default '' check (length(plan_note) <= 4000),
  origin text not null default 'COACH_AUTHORED'
    check (origin in ('COACH_AUTHORED', 'ATHLETE_PROPOSAL', 'LEGACY_IMPORT')),
  source_reference text check (length(btrim(source_reference)) between 1 and 500),
  authored_by uuid references public.users_master(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.users_master(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (length(review_note) <= 4000),
  created_at timestamptz not null default now(),
  unique (plan_id, version_number),
  unique (id, plan_id),
  constraint athlete_nutrition_version_dates_chk
    check (ends_on is null or (starts_on is not null and ends_on > starts_on)),
  constraint athlete_nutrition_version_review_state_chk check (
    (status = 'DRAFT'
      and submitted_at is null and reviewed_at is null
      and reviewed_by is null and review_note is null)
    or (status = 'PENDING_REVIEW'
      and submitted_at is not null and reviewed_at is null
      and reviewed_by is null and review_note is null)
    or (status in ('APPROVED', 'REJECTED')
      and submitted_at is not null and reviewed_at is not null)
  ),
  constraint athlete_nutrition_version_review_time_chk check (
    (submitted_at is null or submitted_at >= created_at)
    and (reviewed_at is null or reviewed_at >= submitted_at)
  ),
  constraint athlete_nutrition_version_approved_targets_chk check (
    status <> 'APPROVED' or (
      starts_on is not null
      and target_calories_kcal is not null and target_calories_kcal > 0
      and target_protein_g is not null
      and target_carbs_g is not null
      and target_fat_g is not null
    )
  )
);

create index athlete_nutrition_versions_author_idx
  on public.athlete_nutrition_plan_versions (authored_by);
create index athlete_nutrition_versions_reviewer_idx
  on public.athlete_nutrition_plan_versions (reviewed_by);

-- A selected version must belong to this exact plan. Selection is not proof
-- that the version is effective today; future read/activation RPCs also check
-- program lifecycle and the version's local [starts_on, ends_on) date window.
alter table public.athlete_nutrition_plans
  add constraint athlete_nutrition_active_version_fk
  foreign key (active_version_id, id)
  references public.athlete_nutrition_plan_versions (id, plan_id)
  on delete no action;

create index athlete_nutrition_plans_active_version_idx
  on public.athlete_nutrition_plans (active_version_id, id);

create table public.athlete_nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null
    references public.athlete_nutrition_plan_versions(id) on delete cascade,
  day_type text not null default 'EVERY_DAY'
    check (day_type in ('EVERY_DAY', 'TRAINING_DAY', 'REST_DAY')),
  meal_number integer not null check (meal_number between 1 and 20),
  title text not null check (length(btrim(title)) between 1 and 120),
  local_time time,
  instructions text not null default '' check (length(instructions) <= 4000),
  unique (version_id, day_type, meal_number)
);

create table public.athlete_nutrition_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null
    references public.athlete_nutrition_meals(id) on delete cascade,
  position integer not null check (position between 1 and 100),
  food_name text not null check (length(btrim(food_name)) between 1 and 200),
  quantity numeric(10,3) not null check (quantity > 0 and quantity <= 1000000),
  quantity_unit text not null
    check (quantity_unit in ('G', 'ML', 'SERVING', 'UNIT')),
  portion_description text check (length(btrim(portion_description)) between 1 and 500),
  preparation text not null default '' check (length(preparation) <= 2000),
  calories_kcal numeric(10,3) check (calories_kcal between 0 and 1000000),
  protein_g numeric(10,3) check (protein_g between 0 and 1000000),
  carbs_g numeric(10,3) check (carbs_g between 0 and 1000000),
  fat_g numeric(10,3) check (fat_g between 0 and 1000000),
  nutrient_source text not null default 'COACH_DECLARED'
    check (nutrient_source in ('COACH_DECLARED', 'FOOD_LABEL', 'FOOD_CATALOG')),
  source_reference text check (length(btrim(source_reference)) between 1 and 500),
  unique (meal_id, position),
  constraint athlete_nutrition_item_source_chk check (
    nutrient_source = 'COACH_DECLARED' or source_reference is not null
  ),
  constraint athlete_nutrition_item_portion_chk check (
    quantity_unit in ('G', 'ML') or portion_description is not null
  )
);

comment on table public.athlete_nutrition_plans is
  'One nutrition plan per canonical program; no automatic legacy import.';
comment on table public.athlete_nutrition_plan_versions is
  'Approved snapshots are immutable; independent of athletes_profile.routine_status and diet_status.';
comment on column public.athlete_nutrition_plan_versions.ends_on is
  'Exclusive local date boundary in time_zone; null means no version-specific end date.';
comment on column public.athlete_nutrition_meals.day_type is
  'Use the complete matching TRAINING_DAY/REST_DAY set when present; otherwise EVERY_DAY. Do not merge sets.';
comment on column public.athlete_nutrition_meal_items.calories_kcal is
  'Declared nutrient amount for this entire portion, not per 100 g. Null means unknown, never zero.';
comment on column public.athlete_nutrition_meal_items.source_reference is
  'Food label/catalog reference or identifier. A reference is not clinical verification.';

create function private.genesis_guard_nutrition_plan()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.active_version_id is not null then
      raise exception 'GENESIS_NUTRITION_PLAN_MUST_START_EMPTY';
    end if;
    if not exists (
      select 1 from public.athlete_programs p
      where p.id = new.program_id and p.athlete_id = new.athlete_id
        and p.service_focus in ('NUTRITION', 'BOTH')
    ) then
      raise exception 'GENESIS_NUTRITION_PROGRAM_SCOPE_INVALID';
    end if;
  else
    if new.id is distinct from old.id
       or new.athlete_id is distinct from old.athlete_id
       or new.program_id is distinct from old.program_id
       or new.created_at is distinct from old.created_at then
      raise exception 'GENESIS_NUTRITION_PLAN_IDENTITY_IMMUTABLE';
    end if;
  end if;

  if new.active_version_id is not null and not exists (
    select 1 from public.athlete_nutrition_plan_versions v
    where v.id = new.active_version_id and v.plan_id = new.id
      and v.status = 'APPROVED'
  ) then
    raise exception 'GENESIS_NUTRITION_ACTIVE_VERSION_INVALID';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

create function private.genesis_guard_nutrition_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_snapshot_changed boolean;
begin
  if tg_op = 'DELETE' then
    -- Allow the existing canonical account/program cascade, not piecemeal
    -- destruction of a submitted review or an approved historical snapshot.
    if old.status <> 'DRAFT' and exists (
      select 1 from public.athlete_nutrition_plans p where p.id = old.plan_id
    ) then
      raise exception 'GENESIS_NUTRITION_SUBMITTED_VERSION_IMMUTABLE';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' or new.authored_by is null then
      raise exception 'GENESIS_NUTRITION_VERSION_MUST_START_DRAFT';
    end if;
  else
    if new.id is distinct from old.id or new.plan_id is distinct from old.plan_id
       or new.version_number is distinct from old.version_number
       or new.created_at is distinct from old.created_at then
      raise exception 'GENESIS_NUTRITION_VERSION_IDENTITY_IMMUTABLE';
    end if;

    -- Historical actor foreign keys may be nulled by intentional hard-delete.
    -- No content change is permitted through that lifecycle exception.
    if (to_jsonb(new) - array['authored_by','reviewed_by']) =
       (to_jsonb(old) - array['authored_by','reviewed_by'])
       and (new.authored_by is not distinct from old.authored_by or (
         new.authored_by is null and not exists (
           select 1 from public.users_master u where u.id = old.authored_by)))
       and (new.reviewed_by is not distinct from old.reviewed_by or (
         new.reviewed_by is null and not exists (
           select 1 from public.users_master u where u.id = old.reviewed_by)))
    then
      return new;
    end if;

    if old.status in ('APPROVED', 'REJECTED') then
      raise exception 'GENESIS_NUTRITION_REVIEWED_VERSION_IMMUTABLE';
    end if;

    if new.authored_by is distinct from old.authored_by then
      raise exception 'GENESIS_NUTRITION_AUTHOR_IMMUTABLE';
    end if;

    if old.status = 'DRAFT' then
      if new.status not in ('DRAFT', 'PENDING_REVIEW') then
        raise exception 'GENESIS_NUTRITION_REVIEW_TRANSITION_INVALID';
      end if;
    else
      v_snapshot_changed :=
        (to_jsonb(new) - array['status','reviewed_by','reviewed_at','review_note'])
        is distinct from
        (to_jsonb(old) - array['status','reviewed_by','reviewed_at','review_note']);
      if v_snapshot_changed or new.status not in ('APPROVED', 'REJECTED') then
        raise exception 'GENESIS_NUTRITION_SUBMITTED_VERSION_IMMUTABLE';
      end if;
      if new.reviewed_by is null then
        raise exception 'GENESIS_NUTRITION_REVIEWER_REQUIRED';
      end if;
    end if;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone
  ) then
    raise exception 'GENESIS_NUTRITION_TIME_ZONE_INVALID';
  end if;

  if new.status in ('PENDING_REVIEW', 'APPROVED') then
    if not exists (
      select 1 from public.athlete_nutrition_meals m where m.version_id = new.id
    ) or exists (
      select 1 from public.athlete_nutrition_meals m
      where m.version_id = new.id and not exists (
        select 1 from public.athlete_nutrition_meal_items i where i.meal_id = m.id
      )
    ) then
      raise exception 'GENESIS_NUTRITION_MEAL_CONTENT_REQUIRED';
    end if;
  end if;
  return new;
end;
$function$;

create function private.genesis_guard_nutrition_meal_content()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_version_id uuid;
  v_status text;
begin
  if tg_table_name = 'athlete_nutrition_meals' then
    if tg_op = 'UPDATE' and (
      new.id is distinct from old.id or new.version_id is distinct from old.version_id
    ) then
      raise exception 'GENESIS_NUTRITION_MEAL_IDENTITY_IMMUTABLE';
    end if;
    if tg_op = 'DELETE' then v_version_id := old.version_id;
    else v_version_id := new.version_id; end if;
  else
    if tg_op = 'UPDATE' and (
      new.id is distinct from old.id or new.meal_id is distinct from old.meal_id
    ) then
      raise exception 'GENESIS_NUTRITION_ITEM_IDENTITY_IMMUTABLE';
    end if;
    if tg_op = 'DELETE' then
      select m.version_id into v_version_id
      from public.athlete_nutrition_meals m where m.id = old.meal_id;
    else
      select m.version_id into v_version_id
      from public.athlete_nutrition_meals m where m.id = new.meal_id;
    end if;
  end if;

  -- Serialize child edits with submission/review of the parent snapshot.
  select v.status into v_status
  from public.athlete_nutrition_plan_versions v
  where v.id = v_version_id for update;

  if v_status is null then
    if tg_op = 'DELETE' then return old; end if;
    raise exception 'GENESIS_NUTRITION_VERSION_REQUIRED';
  end if;
  if v_status <> 'DRAFT' then
    raise exception 'GENESIS_NUTRITION_MEAL_CONTENT_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create trigger trg_genesis_nutrition_plan_guard
  before insert or update on public.athlete_nutrition_plans
  for each row execute function private.genesis_guard_nutrition_plan();
create trigger trg_genesis_nutrition_version_guard
  before insert or update or delete on public.athlete_nutrition_plan_versions
  for each row execute function private.genesis_guard_nutrition_version();
create trigger trg_genesis_nutrition_meal_guard
  before insert or update or delete on public.athlete_nutrition_meals
  for each row execute function private.genesis_guard_nutrition_meal_content();
create trigger trg_genesis_nutrition_item_guard
  before insert or update or delete on public.athlete_nutrition_meal_items
  for each row execute function private.genesis_guard_nutrition_meal_content();

-- Private, actor-checked policy helper. Never expose privileged logic as a
-- public SECURITY DEFINER RPC. Account status is checked from canonical data.
create function private.genesis_nutrition_access_scope(p_plan_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $function$
  select case
    when u.role::text = 'SUPER_ADMIN' then 'ADMIN'
    when u.role::text = 'COACH'
      and c.user_id = u.id and p.coach_id = c.id
      and c.b2b_plan in ('EVOLUCION', 'ELITE') then 'EDITOR'
    when u.role::text = 'COACH'
      and c.user_id = u.id and p.coach_id = c.id
      and c.b2b_plan = 'IGNICION' then 'VIEWER'
    when a.user_id = u.id and u.role::text in ('ATHLETE', 'COACH') then 'OWNER'
    else null
  end
  from public.athlete_nutrition_plans n
  join public.athletes_profile a on a.id = n.athlete_id
  join public.athlete_programs p
    on p.id = n.program_id and p.athlete_id = n.athlete_id
  join public.users_master u
    on u.id = (select auth.uid()) and u.account_status::text = 'ACTIVE'
  left join public.coaches_profile c on c.id = a.coach_id
  where n.id = p_plan_id;
$function$;

revoke all on function private.genesis_guard_nutrition_plan()
  from public, anon, authenticated;
revoke all on function private.genesis_guard_nutrition_version()
  from public, anon, authenticated;
revoke all on function private.genesis_guard_nutrition_meal_content()
  from public, anon, authenticated;
revoke all on function private.genesis_nutrition_access_scope(uuid)
  from public, anon, authenticated;
grant execute on function private.genesis_nutrition_access_scope(uuid)
  to authenticated;

alter table public.athlete_nutrition_plans enable row level security;
alter table public.athlete_nutrition_plan_versions enable row level security;
alter table public.athlete_nutrition_meals enable row level security;
alter table public.athlete_nutrition_meal_items enable row level security;

create policy athlete_nutrition_plans_select_authorized
  on public.athlete_nutrition_plans for select to authenticated
  using (private.genesis_nutrition_access_scope(id) is not null);

create policy athlete_nutrition_versions_select_authorized
  on public.athlete_nutrition_plan_versions for select to authenticated
  using (
    case private.genesis_nutrition_access_scope(plan_id)
      when 'ADMIN' then true
      when 'EDITOR' then true
      when 'OWNER' then status = 'APPROVED'
      when 'VIEWER' then status = 'APPROVED'
      else false
    end
  );

create policy athlete_nutrition_meals_select_authorized
  on public.athlete_nutrition_meals for select to authenticated
  using (exists (
    select 1 from public.athlete_nutrition_plan_versions v
    where v.id = athlete_nutrition_meals.version_id
  ));

create policy athlete_nutrition_items_select_authorized
  on public.athlete_nutrition_meal_items for select to authenticated
  using (exists (
    select 1 from public.athlete_nutrition_meals m
    where m.id = athlete_nutrition_meal_items.meal_id
  ));

revoke all on table public.athlete_nutrition_plans,
  public.athlete_nutrition_plan_versions, public.athlete_nutrition_meals,
  public.athlete_nutrition_meal_items from public, anon, authenticated;

grant select on table public.athlete_nutrition_plans,
  public.athlete_nutrition_plan_versions, public.athlete_nutrition_meals,
  public.athlete_nutrition_meal_items to authenticated;

grant all on table public.athlete_nutrition_plans,
  public.athlete_nutrition_plan_versions, public.athlete_nutrition_meals,
  public.athlete_nutrition_meal_items to service_role;
