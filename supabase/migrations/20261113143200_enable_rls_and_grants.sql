-- Row Level Security and least-privilege table grants.
--
-- Clients can read their own profile, their own spaces, and the membership rows
-- of spaces they belong to. They can update only their own display name/avatar.
-- Profile and personal-space creation happens through the auth trigger, so no
-- client INSERT policies exist for spaces or memberships.

begin;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Members can view their spaces"
on public.spaces
for select
to authenticated
using (private.is_space_member(id));

create policy "Members can view space memberships"
on public.space_members
for select
to authenticated
using (private.is_space_member(space_id));

-- Remove Supabase's broad default table privileges, then grant the minimum
-- needed by the authenticated browser client.
revoke all on table public.profiles, public.spaces, public.space_members
  from anon, authenticated;

grant select on table public.profiles, public.spaces, public.space_members
  to authenticated;

grant update (display_name, avatar_url) on table public.profiles
  to authenticated;

commit;
