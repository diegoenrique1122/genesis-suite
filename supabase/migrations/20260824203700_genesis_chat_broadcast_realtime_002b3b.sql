-- Genesis OS 002B3.B
-- Secure database Broadcast transport for Genesis Network chat.
-- Keeps 002B3.A persistence/RLS authority intact and adds low-latency private Realtime topics.

create or replace function private.genesis_chat_topic(
  p_channel_type text,
  p_sender_id uuid,
  p_recipient_id uuid
)
returns text
language sql
immutable
set search_path = public, private, pg_temp
as $$
  select case
    when p_channel_type = 'GLOBAL_WALL' then
      'genesis:global'
    when p_channel_type = 'COACHES_ROOM' then
      'genesis:coaches'
    when p_channel_type = 'PRIVATE'
      and p_sender_id is not null
      and p_recipient_id is not null
      and p_sender_id <> p_recipient_id
    then
      'genesis:private:'
      || least(p_sender_id::text, p_recipient_id::text)
      || ':'
      || greatest(p_sender_id::text, p_recipient_id::text)
    else null
  end;
$$;

create or replace function private.can_receive_genesis_chat_broadcast(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid;
  v_parts text[];
  v_a uuid;
  v_b uuid;
  v_other uuid;
begin
  v_uid := auth.uid();
  if v_uid is null or p_topic is null then
    return false;
  end if;

  if p_topic = 'genesis:global' then
    return private.can_access_global_chat();
  end if;

  if p_topic = 'genesis:coaches' then
    return private.can_access_coaches_room();
  end if;

  if p_topic not like 'genesis:private:%' then
    return false;
  end if;

  v_parts := string_to_array(p_topic, ':');
  if array_length(v_parts, 1) <> 4
     or v_parts[1] <> 'genesis'
     or v_parts[2] <> 'private'
  then
    return false;
  end if;

  begin
    v_a := v_parts[3]::uuid;
    v_b := v_parts[4]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if v_a = v_b then
    return false;
  end if;

  if v_uid = v_a then
    v_other := v_b;
  elsif v_uid = v_b then
    v_other := v_a;
  else
    return false;
  end if;

  return private.can_private_chat_with(v_other);
end;
$$;

revoke all on function private.genesis_chat_topic(text, uuid, uuid) from public, anon;
revoke all on function private.can_receive_genesis_chat_broadcast(text) from public, anon;
grant execute on function private.genesis_chat_topic(text, uuid, uuid) to authenticated;
grant execute on function private.can_receive_genesis_chat_broadcast(text) to authenticated;

-- Realtime Authorization uses realtime.topic() when a private channel is joined.
-- The permissive policy grants Genesis chat topics only when the canonical
-- Genesis role/plan/relationship helpers authorize the current JWT.
drop policy if exists genesis_chat_broadcast_receive on realtime.messages;
create policy genesis_chat_broadcast_receive
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and private.can_receive_genesis_chat_broadcast((select realtime.topic()))
);

-- Defensive restrictive policy: if another permissive Realtime SELECT policy
-- already exists, it cannot accidentally bypass Genesis authorization for
-- topics beginning with "genesis:". Non-Genesis topics are left untouched.
drop policy if exists genesis_chat_broadcast_guard on realtime.messages;
create policy genesis_chat_broadcast_guard
as restrictive
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) not like 'genesis:%'
  or (
    extension = 'broadcast'
    and private.can_receive_genesis_chat_broadcast((select realtime.topic()))
  )
);

create or replace function private.broadcast_genesis_chat_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic text;
begin
  if TG_OP = 'INSERT' then
    v_topic := private.genesis_chat_topic(
      NEW.channel_type,
      NEW.sender_id,
      NEW.recipient_id
    );
  elsif TG_OP = 'DELETE' then
    v_topic := private.genesis_chat_topic(
      OLD.channel_type,
      OLD.sender_id,
      OLD.recipient_id
    );
  else
    return null;
  end if;

  if v_topic is null then
    return null;
  end if;

  perform realtime.broadcast_changes(
    v_topic,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  return null;
end;
$$;

revoke all on function private.broadcast_genesis_chat_change() from public, anon, authenticated;

drop trigger if exists trg_broadcast_genesis_chat_change on public.chat_messages;
create trigger trg_broadcast_genesis_chat_change
after insert or delete on public.chat_messages
for each row execute function private.broadcast_genesis_chat_change();
