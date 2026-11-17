begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hardening-a@example.com', '{"display_name":"Hardening A"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'hardening-b@example.com', '{"display_name":"Hardening B"}');

select throws_ok(
  $$delete from public.spaces where created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and type = 'PERSONAL'$$,
  '23514', 'Personal spaces cannot be deleted while their user exists',
  'a privileged caller cannot delete a live user personal space'
);
select throws_ok(
  $$delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'Personal spaces cannot be deleted while their user exists',
  'direct profile deletion cannot bypass personal space protection'
);

-- Keep constraints deferred: insert parent then OWNER, and force evaluation only
-- after both exist. A nested exception block rolls back a deliberately invalid
-- deferred transaction fragment without losing the enclosing test fixtures.
create function pg_temp.ownerless_deferred_operation()
returns void language plpgsql as $$
begin
  insert into public.spaces (name, type, created_by)
  values ('Ownerless deferred', 'SHARED', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  set constraints all immediate;
end;
$$;
select throws_ok('select pg_temp.ownerless_deferred_operation()', '23514', null,
  'deferred ownerless space fails when deferred constraints are checked');

insert into public.spaces (id, name, type, created_by)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Deferred shared', 'SHARED', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.space_members (space_id, user_id, role)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'OWNER');
select lives_ok('set constraints all immediate', 'space and owner can be created atomically with deferred constraints');
set constraints all deferred;

-- A shared OWNER transfer requires removing the old OWNER before inserting the
-- new one, because the at-most-one index is immediate. The final state is valid.
update public.space_members set role = 'MEMBER'
where space_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
insert into public.space_members (space_id, user_id, role)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OWNER');
select lives_ok('set constraints all immediate', 'deferred OWNER transfer validates the final state');
set constraints all deferred;

create function pg_temp.remove_deferred_owner()
returns void language plpgsql as $$
begin
  delete from public.space_members
  where space_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and role = 'OWNER';
  set constraints all immediate;
end;
$$;
select throws_ok('select pg_temp.remove_deferred_owner()', '23514', null,
  'removing the last shared OWNER fails deferred validation');

select is((select count(*) from public.space_members where space_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and role = 'OWNER'),
  1::bigint, 'failed deferred validation restores the OWNER');

-- The auth row is absent during its cascade; the personal deletion guard must
-- permit this path and all deferred owner checks must accept deleted spaces.
select lives_ok($$delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'auth account deletion cascades successfully');
select lives_ok('set constraints all immediate', 'account deletion passes deferred OWNER checks');
select is((select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'account profile is removed');
select is((select count(*) from public.spaces where created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'account spaces are removed');
select is((select count(*) from public.space_members where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' or space_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 0::bigint, 'account memberships and memberships of deleted spaces are removed');
select is((select count(*) from public.spaces where created_by = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and type = 'PERSONAL'), 1::bigint, 'another user personal space remains intact');

-- Catalog assertions catch explicit default grants, which revoking only PUBLIC
-- would miss. Every definer function must also have a trusted owner.
select ok(p.proconfig @> array['search_path=""'], p.proname || ' pins an empty search_path')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.prosecdef;
select ok(not has_function_privilege('anon', p.oid, 'EXECUTE'), p.proname || ' denies anonymous execution')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private';
select ok(has_function_privilege('authenticated', p.oid, 'EXECUTE') = (p.proname = 'is_space_member'),
  p.proname || ' has the expected authenticated EXECUTE privilege')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private';
select ok(r.rolsuper or r.rolbypassrls or p.proowner = c.relowner,
  p.proname || ' has an owner able to bypass membership RLS')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner cross join pg_class c
where n.nspname = 'private' and p.prosecdef and c.oid = 'public.space_members'::regclass;
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anonymous role cannot use private schema');
select ok(c.relrowsecurity, c.relname || ' has RLS enabled')
from pg_class c where c.oid in ('public.profiles'::regclass, 'public.spaces'::regclass, 'public.space_members'::regclass);

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;
select throws_ok($$insert into public.space_members (space_id, user_id, role) values (gen_random_uuid(), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OWNER')$$,
  '42501', null, 'authenticated caller cannot create an OWNER membership');
select throws_ok($$update public.space_members set role = 'ADMIN'$$, '42501', null, 'authenticated caller cannot change membership roles');
select throws_ok($$update public.space_members set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$, '42501', null, 'authenticated caller cannot reassign memberships');
select throws_ok('delete from public.space_members', '42501', null, 'authenticated caller cannot delete memberships');
select throws_ok('delete from public.spaces', '42501', null, 'authenticated caller cannot delete spaces');
select throws_ok($$update public.profiles set id = gen_random_uuid()$$, '42501', null, 'authenticated caller cannot rewrite profile identity');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anonymous caller cannot read profiles');
select throws_ok('select * from public.spaces', '42501', null, 'anonymous caller cannot read spaces');
select throws_ok('select * from public.space_members', '42501', null, 'anonymous caller cannot read memberships');
select throws_ok('delete from public.space_members', '42501', null, 'anonymous caller cannot delete memberships');
reset role;

select * from finish();
rollback;
