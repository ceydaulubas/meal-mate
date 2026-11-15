-- Defense in depth for membership rows.
--
-- The browser roles cannot update memberships at all, but a privileged caller
-- must not be able to rewrite a membership's identity or demote a personal
-- space's OWNER. Shared-space roles remain changeable for future admin tooling.

begin;

create function private.guard_space_member_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space_type public.space_type;
begin
  if new.space_id <> old.space_id or new.user_id <> old.user_id then
    raise exception 'Membership identity fields cannot be changed'
      using errcode = '23514';
  end if;

  select type
  into v_space_type
  from public.spaces
  where id = new.space_id;

  if v_space_type = 'PERSONAL' and new.role <> 'OWNER' then
    raise exception 'A personal space member must remain an OWNER'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_space_member_updates() from public;

create trigger space_members_guard_updates
before update on public.space_members
for each row
execute function private.guard_space_member_updates();

commit;
