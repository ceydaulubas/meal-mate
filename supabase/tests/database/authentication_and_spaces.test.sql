-- Database integration tests for Authentication & Personal Space.
-- Run against the isolated local Supabase stack with: pnpm supabase test db
--
-- The entire file runs in one transaction and is rolled back.

begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- Fixtures: auth.users trigger creates profiles, personal spaces and owners.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Alice"}'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Bob"}'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'carol@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dave@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"   "}'::jsonb
  );

insert into public.spaces (name, type, created_by)
values (
  'Family Kitchen',
  'SHARED',
  '22222222-2222-4222-8222-222222222222'
);

insert into public.space_members (space_id, user_id, role)
select id, '22222222-2222-4222-8222-222222222222', 'OWNER'
from public.spaces
where name = 'Family Kitchen'
  and created_by = '22222222-2222-4222-8222-222222222222';

insert into public.space_members (space_id, user_id, role)
select id, '11111111-1111-4111-8111-111111111111', 'MEMBER'
from public.spaces
where name = 'Family Kitchen'
  and created_by = '22222222-2222-4222-8222-222222222222';

-- ---------------------------------------------------------------------------
-- Trigger: profile, personal space, OWNER membership, safe display names.
-- ---------------------------------------------------------------------------
select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Alice',
  'auth trigger creates a profile from display name metadata'
);

select is(
  (
    select count(*)
    from public.spaces
    where created_by = '11111111-1111-4111-8111-111111111111'
      and type = 'PERSONAL'
  ),
  1::bigint,
  'auth trigger creates exactly one personal space per user'
);

select is(
  (
    select name
    from public.spaces
    where created_by = '11111111-1111-4111-8111-111111111111'
      and type = 'PERSONAL'
  ),
  'Alice''s Space',
  'personal space gets a safe default name'
);

select is(
  (
    select count(*)
    from public.space_members m
    join public.spaces s on s.id = m.space_id
    where s.created_by = '11111111-1111-4111-8111-111111111111'
      and s.type = 'PERSONAL'
      and m.user_id = '11111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'personal space has exactly one membership'
);

select is(
  (
    select m.role::text
    from public.space_members m
    join public.spaces s on s.id = m.space_id
    where s.created_by = '11111111-1111-4111-8111-111111111111'
      and s.type = 'PERSONAL'
      and m.user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'OWNER',
  'personal space membership is OWNER'
);

select is(
  (select display_name from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'carol',
  'missing display name falls back to the email prefix'
);

select is(
  (select display_name from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
  'dave',
  'blank display name falls back to the email prefix'
);

-- ---------------------------------------------------------------------------
-- Database constraints.
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    'insert into public.spaces (name, type, created_by) values (%L, %L, %L)',
    'Duplicate Personal',
    'PERSONAL',
    '11111111-1111-4111-8111-111111111111'
  ),
  '23505',
  null,
  'a user cannot create a duplicate personal space'
);

select throws_ok(
  format(
    'insert into public.space_members (space_id, user_id, role) values ((select id from public.spaces where name = %L and created_by = %L), %L, %L)',
    'Family Kitchen',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'OWNER'
  ),
  '23505',
  null,
  'a space cannot have a second OWNER'
);

select throws_ok(
  format(
    'insert into public.space_members (space_id, user_id, role) values ((select id from public.spaces where created_by = %L and type = %L), %L, %L)',
    '11111111-1111-4111-8111-111111111111',
    'PERSONAL',
    '22222222-2222-4222-8222-222222222222',
    'MEMBER'
  ),
  '23514',
  'Personal spaces cannot have additional members',
  'personal spaces reject additional members'
);

select throws_ok(
  format(
    'insert into public.space_members (space_id, user_id, role) values ((select id from public.spaces where name = %L and created_by = %L), %L, %L)',
    'Family Kitchen',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'MEMBER'
  ),
  '23505',
  null,
  'a user cannot join the same space twice'
);

set constraints all immediate;

select throws_ok(
  format(
    'insert into public.spaces (name, type, created_by) values (%L, %L, %L)',
    'Ownerless Space',
    'SHARED',
    '11111111-1111-4111-8111-111111111111'
  ),
  '23514',
  null,
  'a space cannot exist without an OWNER'
);

select throws_ok(
  format(
    'delete from public.space_members where space_id = %L and user_id = %L',
    (
      select id
      from public.spaces
      where created_by = '11111111-1111-4111-8111-111111111111'
        and type = 'PERSONAL'
    ),
    '11111111-1111-4111-8111-111111111111'
  ),
  '23514',
  null,
  'a space cannot lose its OWNER'
);

select throws_ok(
  format(
    'update public.space_members set role = %L where space_id = %L and user_id = %L',
    'ADMIN',
    (
      select id
      from public.spaces
      where created_by = '11111111-1111-4111-8111-111111111111'
        and type = 'PERSONAL'
    ),
    '11111111-1111-4111-8111-111111111111'
  ),
  '23514',
  'A personal space member must remain an OWNER',
  'a personal space owner cannot be demoted'
);

select throws_ok(
  format(
    'update public.space_members set user_id = %L where space_id = %L and user_id = %L',
    '22222222-2222-4222-8222-222222222222',
    (
      select id
      from public.spaces
      where created_by = '11111111-1111-4111-8111-111111111111'
        and type = 'PERSONAL'
    ),
    '11111111-1111-4111-8111-111111111111'
  ),
  '23514',
  'Membership identity fields cannot be changed',
  'a membership cannot be reassigned to another user'
);

set constraints all deferred;

-- ---------------------------------------------------------------------------
-- RLS: Alice can access her own and shared spaces, never Bob's personal space.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'RLS: users see only their own profile'
);

select is(
  (
    select count(*)
    from public.spaces
    where created_by = '22222222-2222-4222-8222-222222222222'
      and type = 'PERSONAL'
  ),
  0::bigint,
  'RLS: another user''s personal space is invisible'
);

select is(
  (select count(*) from public.spaces),
  2::bigint,
  'RLS: users see their personal space and spaces they belong to'
);

select is(
  (select count(*) from public.space_members),
  3::bigint,
  'RLS: users see memberships for spaces they belong to'
);

select is(
  (
    select count(*)
    from public.space_members m
    join public.spaces s on s.id = m.space_id
    where s.created_by = '22222222-2222-4222-8222-222222222222'
      and s.type = 'PERSONAL'
  ),
  0::bigint,
  'RLS: another user''s personal membership is invisible'
);

update public.profiles
set display_name = 'Alice Updated'
where id = '11111111-1111-4111-8111-111111111111';

select is(
  (
    select display_name
    from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'Alice Updated',
  'RLS: users can update their own profile'
);

with updated as (
  update public.profiles
  set display_name = 'Hacked'
  where id = '22222222-2222-4222-8222-222222222222'
  returning id
)
select is(
  (select count(*) from updated),
  0::bigint,
  'RLS: users cannot update another profile'
);

select throws_ok(
  format(
    'insert into public.spaces (name, type, created_by) values (%L, %L, %L)',
    'Sneaky Space',
    'SHARED',
    '11111111-1111-4111-8111-111111111111'
  ),
  '42501',
  null,
  'RLS: users cannot create spaces directly'
);

select throws_ok(
  format(
    'insert into public.space_members (space_id, user_id, role) values ((select id from public.spaces where name = %L and created_by = %L), %L, %L)',
    'Family Kitchen',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'MEMBER'
  ),
  '42501',
  null,
  'RLS: users cannot add memberships directly'
);

select throws_ok(
  format(
    'update public.space_members set role = %L where user_id = %L',
    'ADMIN',
    '11111111-1111-4111-8111-111111111111'
  ),
  '42501',
  null,
  'RLS: users cannot escalate their own membership role'
);

select throws_ok(
  format(
    'delete from public.space_members where user_id = %L',
    '11111111-1111-4111-8111-111111111111'
  ),
  '42501',
  null,
  'RLS: users cannot delete memberships directly'
);

reset role;

-- Confirm the failed cross-user update left Bob's row unchanged.
select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Bob',
  'a blocked cross-user update does not change the target profile'
);

-- Unauthenticated clients have no table access.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select * from public.profiles',
  '42501',
  null,
  'RLS: anonymous clients cannot read profiles'
);

reset role;

select * from finish();
rollback;
