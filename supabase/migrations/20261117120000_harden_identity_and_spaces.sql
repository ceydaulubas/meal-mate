-- Forward upgrade for installations that already applied Task 02. The initial
-- migration also establishes RLS/ACLs atomically for new installations.
begin;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
revoke all on table public.profiles, public.spaces, public.space_members
  from public, anon, authenticated;
grant select on table public.profiles, public.spaces, public.space_members
  to authenticated;
grant update (display_name, avatar_url) on table public.profiles
  to authenticated;

-- A direct profile deletion must not remove a live user's personal space.
-- During auth.users ON DELETE CASCADE, the parent auth row is already absent.
create function private.guard_personal_space_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.type = 'PERSONAL'
    and exists (select 1 from auth.users where id = old.created_by)
  then
    raise exception 'Personal spaces cannot be deleted while their user exists'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger spaces_guard_deletion
before delete on public.spaces
for each row
execute function private.guard_personal_space_deletion();

-- Supabase installations can have explicit default EXECUTE grants as well as
-- PUBLIC grants. Trigger functions need no browser-callable EXECUTE privilege.
revoke all on function private.set_updated_at(),
  private.initialize_new_user(), private.enforce_personal_space_membership(),
  private.assert_space_has_owner(), private.guard_space_updates(),
  private.guard_space_member_updates(), private.guard_personal_space_deletion(),
  private.is_space_member(uuid)
  from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_space_member(uuid) to authenticated;

commit;
