-- Genesis OS 002B3.A
-- Secure active chat_messages and freeze unused community tables safely.

create or replace function private.can_access_global_chat()
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;

  select um.role::text, um.account_status::text
    into v_role, v_status
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_status is distinct from 'ACTIVE' then return false; end if;
  if v_role = 'SUPER_ADMIN' then return true; end if;

  if v_role = 'COACH' then
    return exists (
      select 1 from public.coaches_profile cp
      where cp.user_id = v_uid and cp.b2b_plan = 'ELITE'
    );
  end if;

  if v_role = 'ATHLETE' then
    return exists (
      select 1 from public.athletes_profile ap
      where ap.user_id = v_uid and ap.b2c_plan = 'ELITE'
    );
  end if;

  return false;
end;
$$;

create or replace function private.can_access_coaches_room()
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;

  select um.role::text, um.account_status::text
    into v_role, v_status
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_status is distinct from 'ACTIVE' then return false; end if;
  if v_role = 'SUPER_ADMIN' then return true; end if;

  return v_role = 'COACH'
    and exists (
      select 1 from public.coaches_profile cp
      where cp.user_id = v_uid and cp.b2b_plan = 'ELITE'
    );
end;
$$;

create or replace function private.can_private_chat_with(p_other_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_status text;
  v_other_role text;
  v_other_status text;
  v_coach_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null or p_other_user is null or p_other_user = v_uid then return false; end if;

  select um.role::text, um.account_status::text
    into v_role, v_status
  from public.users_master um
  where um.id = v_uid
  limit 1;

  select um.role::text, um.account_status::text
    into v_other_role, v_other_status
  from public.users_master um
  where um.id = p_other_user
  limit 1;

  if v_status is distinct from 'ACTIVE' then return false; end if;
  if v_other_role is null then return false; end if;

  if v_role = 'SUPER_ADMIN' then
    return v_other_role = 'COACH';
  end if;

  if v_role = 'COACH' then
    if v_other_role = 'SUPER_ADMIN' then
      return v_other_status = 'ACTIVE';
    end if;

    if v_other_role <> 'ATHLETE' or v_other_status <> 'ACTIVE' then
      return false;
    end if;

    select cp.id into v_coach_id
    from public.coaches_profile cp
    where cp.user_id = v_uid
    limit 1;

    return v_coach_id is not null
      and exists (
        select 1 from public.athletes_profile ap
        where ap.user_id = p_other_user
          and ap.coach_id = v_coach_id
      );
  end if;

  if v_role = 'ATHLETE' then
    if v_other_role <> 'COACH' or v_other_status <> 'ACTIVE' then
      return false;
    end if;

    return exists (
      select 1
      from public.athletes_profile ap
      join public.coaches_profile cp on cp.id = ap.coach_id
      where ap.user_id = v_uid
        and cp.user_id = p_other_user
    );
  end if;

  return false;
end;
$$;

create or replace function private.can_send_chat_message(p_channel text, p_recipient uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_status text;
  v_banned boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;

  select um.account_status::text, coalesce(um.is_chat_banned, false)
    into v_status, v_banned
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_status is distinct from 'ACTIVE' or v_banned then return false; end if;

  if p_channel = 'GLOBAL_WALL' then
    return p_recipient is null and private.can_access_global_chat();
  elsif p_channel = 'COACHES_ROOM' then
    return p_recipient is null and private.can_access_coaches_room();
  elsif p_channel = 'PRIVATE' then
    return p_recipient is not null and private.can_private_chat_with(p_recipient);
  end if;

  return false;
end;
$$;

create or replace function private.can_access_coach_community(p_coach_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_status text;
begin
  v_uid := auth.uid();
  if v_uid is null or p_coach_id is null then return false; end if;

  select um.role::text, um.account_status::text
    into v_role, v_status
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_status is distinct from 'ACTIVE' then return false; end if;
  if v_role = 'SUPER_ADMIN' then return true; end if;

  if v_role = 'COACH' then
    return exists (
      select 1 from public.coaches_profile cp
      where cp.id = p_coach_id
        and cp.user_id = v_uid
        and cp.b2b_plan = 'ELITE'
    );
  end if;

  if v_role = 'ATHLETE' then
    return exists (
      select 1 from public.athletes_profile ap
      where ap.user_id = v_uid
        and ap.coach_id = p_coach_id
        and ap.b2c_plan = 'ELITE'
    );
  end if;

  return false;
end;
$$;

revoke all on function private.can_access_global_chat() from public, anon;
revoke all on function private.can_access_coaches_room() from public, anon;
revoke all on function private.can_private_chat_with(uuid) from public, anon;
revoke all on function private.can_send_chat_message(text, uuid) from public, anon;
revoke all on function private.can_access_coach_community(uuid) from public, anon;
grant execute on function private.can_access_global_chat() to authenticated;
grant execute on function private.can_access_coaches_room() to authenticated;
grant execute on function private.can_private_chat_with(uuid) to authenticated;
grant execute on function private.can_send_chat_message(text, uuid) to authenticated;
grant execute on function private.can_access_coach_community(uuid) to authenticated;

create or replace function private.guard_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_status text;
  v_banned boolean;
  v_master_name text;
  v_profile_name text;
  v_coach_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'GENESIS_CHAT: authentication required';
  end if;

  select um.role::text, um.account_status::text, coalesce(um.is_chat_banned, false), um.full_name
    into v_role, v_status, v_banned, v_master_name
  from public.users_master um
  where um.id = v_uid
  limit 1;

  if v_role is null or v_status <> 'ACTIVE' then
    raise exception 'GENESIS_CHAT: active Genesis identity required';
  end if;

  if v_banned then
    raise exception 'GENESIS_CHAT: user is blocked from communications';
  end if;

  new.message := btrim(coalesce(new.message, ''));
  if char_length(new.message) < 1 or char_length(new.message) > 2000 then
    raise exception 'GENESIS_CHAT: message length must be between 1 and 2000 characters';
  end if;

  if not private.can_send_chat_message(new.channel_type, new.recipient_id) then
    raise exception 'GENESIS_CHAT: channel or recipient not authorized';
  end if;

  new.id := gen_random_uuid();
  new.sender_id := v_uid;
  new.sender_role := v_role;
  new.created_at := now();

  if v_role = 'SUPER_ADMIN' then
    new.sender_name := coalesce(nullif(btrim(v_master_name), ''), 'Súper Admin');
    new.user_coach_id := null;
  elsif v_role = 'COACH' then
    select cp.id, cp.full_name into v_coach_id, v_profile_name
    from public.coaches_profile cp
    where cp.user_id = v_uid
    limit 1;

    if v_coach_id is null then
      raise exception 'GENESIS_CHAT: coach profile required';
    end if;

    new.sender_name := coalesce(nullif(btrim(v_profile_name), ''), nullif(btrim(v_master_name), ''), 'Coach');
    new.user_coach_id := v_coach_id;
  elsif v_role = 'ATHLETE' then
    select ap.coach_id, ap.full_name into v_coach_id, v_profile_name
    from public.athletes_profile ap
    where ap.user_id = v_uid
    limit 1;

    if v_profile_name is null and v_coach_id is null then
      raise exception 'GENESIS_CHAT: athlete profile required';
    end if;

    new.sender_name := coalesce(nullif(btrim(v_profile_name), ''), nullif(btrim(v_master_name), ''), 'Atleta');
    new.user_coach_id := v_coach_id;
  else
    raise exception 'GENESIS_CHAT: role not authorized';
  end if;

  if new.channel_type <> 'PRIVATE' then
    new.recipient_id := null;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_chat_message_insert() from public, anon, authenticated;

drop trigger if exists trg_guard_chat_message_insert on public.chat_messages;
create trigger trg_guard_chat_message_insert
before insert on public.chat_messages
for each row execute function private.guard_chat_message_insert();

alter table public.chat_messages
  drop constraint if exists chat_messages_message_length_check;
alter table public.chat_messages
  add constraint chat_messages_message_length_check
  check (char_length(btrim(message)) between 1 and 2000);

alter table public.chat_messages
  drop constraint if exists chat_messages_channel_recipient_shape_check;
alter table public.chat_messages
  add constraint chat_messages_channel_recipient_shape_check
  check (
    (channel_type = 'PRIVATE' and recipient_id is not null)
    or (channel_type in ('GLOBAL_WALL','COACHES_ROOM') and recipient_id is null)
  );

drop policy if exists "Escritura Universal" on public.chat_messages;
drop policy if exists "Lectura Muro Global" on public.chat_messages;
drop policy if exists "Lectura Privada" on public.chat_messages;
drop policy if exists "Lectura Sala Coaches" on public.chat_messages;
drop policy if exists chat_messages_select_authorized on public.chat_messages;
drop policy if exists chat_messages_insert_authorized on public.chat_messages;
drop policy if exists chat_messages_delete_super_admin on public.chat_messages;

create policy chat_messages_select_authorized
on public.chat_messages
for select
to authenticated
using (
  (channel_type = 'GLOBAL_WALL' and private.can_access_global_chat())
  or (channel_type = 'COACHES_ROOM' and private.can_access_coaches_room())
  or (
    channel_type = 'PRIVATE'
    and ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id)
    and private.can_private_chat_with(
      case when sender_id = (select auth.uid()) then recipient_id else sender_id end
    )
  )
);

create policy chat_messages_insert_authorized
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and private.can_send_chat_message(channel_type, recipient_id)
);

create policy chat_messages_delete_super_admin
on public.chat_messages
for delete
to authenticated
using (private.is_super_admin());

revoke all on table public.chat_messages from anon, authenticated;
grant select, insert, delete on table public.chat_messages to authenticated;

drop policy if exists "Acceso total community_messages" on public.community_messages;
drop policy if exists community_messages_select_authorized on public.community_messages;
create policy community_messages_select_authorized
on public.community_messages
for select
to authenticated
using (private.can_access_coach_community(coach_id));
revoke all on table public.community_messages from anon, authenticated;
grant select on table public.community_messages to authenticated;

drop policy if exists chat_groups_select_authorized on public.chat_groups;
create policy chat_groups_select_authorized
on public.chat_groups
for select
to authenticated
using (private.can_access_coach_community(coach_id));
revoke all on table public.chat_groups from anon, authenticated;
grant select on table public.chat_groups to authenticated;
