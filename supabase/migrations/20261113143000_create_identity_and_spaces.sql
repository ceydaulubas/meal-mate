-- Core identity and space schema.
--
-- Every auth user receives one profile, one PERSONAL space, and one OWNER
-- membership through a trigger on auth.users. The auth user id is always taken
-- from auth.users, never from client-supplied metadata.

begin;

create type public.space_type as enum ('PERSONAL', 'SHARED');
create type public.space_member_role as enum ('OWNER', 'ADMIN', 'MEMBER');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    char_length(btrim(display_name)) between 1 and 80
  ),
  constraint profiles_avatar_url_length check (
    avatar_url is null or char_length(avatar_url) <= 2048
  )
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.space_type not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spaces_name_length check (char_length(btrim(name)) between 1 and 80)
);

-- A user can own at most one personal space. The trigger below creates it.
create unique index spaces_one_personal_per_user_idx
  on public.spaces (created_by)
  where type = 'PERSONAL';

create index spaces_created_by_idx on public.spaces (created_by);
create index spaces_type_idx on public.spaces (type);

create table public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.space_member_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  constraint space_members_space_user_unique unique (space_id, user_id)
);

-- At most one OWNER per space. A deferred trigger in the next migration
-- guarantees that every space actually has an owner before the transaction commits.
create unique index space_members_one_owner_idx
  on public.space_members (space_id)
  where role = 'OWNER';

create index space_members_user_id_idx on public.space_members (user_id);

-- Internal functions are kept out of the PostgREST-exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create trigger spaces_set_updated_at
before update on public.spaces
for each row
execute function private.set_updated_at();

-- Security-definer membership check used by RLS. Keeping it in a private schema,
-- pinning search_path, and revoking PUBLIC execution avoids recursive policies
-- and broad definer privileges.
create function private.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members
    where space_id = target_space_id
      and user_id = auth.uid()
  );
$$;

revoke all on function private.is_space_member(uuid) from public;
grant execute on function private.is_space_member(uuid) to authenticated;

create function private.initialize_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_personal_space_id uuid;
begin
  v_display_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'MealMate User'
    ),
    80
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name);

  insert into public.spaces (name, type, created_by)
  values (left(v_display_name, 60) || '''s Space', 'PERSONAL', new.id)
  returning id into v_personal_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_personal_space_id, new.id, 'OWNER');

  return new;
end;
$$;

revoke all on function private.initialize_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.initialize_new_user();

commit;
