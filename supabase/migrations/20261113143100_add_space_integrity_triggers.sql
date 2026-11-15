-- Database-level invariants for spaces and memberships.

begin;

-- Personal spaces have exactly one member: the creator, as OWNER.
-- Locking the space row serializes concurrent membership inserts.
create function private.enforce_personal_space_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space public.spaces%rowtype;
  v_member_count integer;
begin
  select *
  into v_space
  from public.spaces
  where id = new.space_id
  for update;

  if not found then
    raise exception 'Space % does not exist', new.space_id
      using errcode = '23503';
  end if;

  if v_space.type = 'PERSONAL' then
    select count(*)
    into v_member_count
    from public.space_members
    where space_id = new.space_id;

    if v_member_count > 0 then
      raise exception 'Personal spaces cannot have additional members'
        using errcode = '23514';
    end if;

    if new.user_id <> v_space.created_by then
      raise exception 'A personal space owner must be its creator'
        using errcode = '23514';
    end if;

    if new.role <> 'OWNER' then
      raise exception 'A personal space member must be an OWNER'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_personal_space_membership() from public;

create trigger space_members_enforce_personal_space
before insert on public.space_members
for each row
execute function private.enforce_personal_space_membership();

-- Guarantees that every space has an owner. This runs deferred so a space and
-- its initial OWNER membership can be inserted atomically in one transaction.
create function private.assert_space_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space_id uuid;
begin
  if tg_table_name = 'spaces' then
    v_space_id := new.id;
  elsif tg_op = 'DELETE' then
    v_space_id := old.space_id;
  else
    v_space_id := new.space_id;
  end if;

  -- Space deletion cascades to membership rows; do not require an owner for a
  -- space that no longer exists.
  if exists (select 1 from public.spaces where id = v_space_id)
    and not exists (
      select 1
      from public.space_members
      where space_id = v_space_id
        and role = 'OWNER'
    )
  then
    raise exception 'Space % must have exactly one OWNER', v_space_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function private.assert_space_has_owner() from public;

create constraint trigger spaces_require_owner
after insert on public.spaces
deferrable initially deferred
for each row
execute function private.assert_space_has_owner();

create constraint trigger space_members_require_owner
after insert or update or delete on public.space_members
deferrable initially deferred
for each row
execute function private.assert_space_has_owner();

-- Space identity fields are immutable. This protects personal-space invariants
-- even if a privileged caller tries to mutate a space.
create function private.guard_space_updates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type <> old.type then
    raise exception 'Space type cannot be changed' using errcode = '23514';
  end if;

  if new.created_by <> old.created_by then
    raise exception 'Space creator cannot be changed' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_space_updates() from public;

create trigger spaces_guard_updates
before update on public.spaces
for each row
execute function private.guard_space_updates();

commit;
