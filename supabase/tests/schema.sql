\set ON_ERROR_STOP on
-- Run as database owner on an isolated test database after applying migrations.
-- Everything, including auth fixtures, is rolled back. No Auth flow is exercised.
\if :{?expected_policy_count}
\else
\set expected_policy_count 0
\endif
begin;
set local timezone = 'UTC';

create function pg_temp.assert_true(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'PASS: %', description;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text)
returns void language plpgsql as $$
declare caught_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics caught_state = returned_sqlstate;
  end;
  if caught_state is distinct from expected_state then
    raise exception 'Expected SQLSTATE %, got %: %', expected_state, caught_state, statement;
  end if;
end;
$$;

select pg_temp.assert_true(to_regclass('public.profiles') is not null, 'profiles exists');
select pg_temp.assert_true(to_regclass('public.user_cert_progress') is not null, 'progress exists');
select pg_temp.assert_true(
  (select pg_get_constraintdef(oid) = 'PRIMARY KEY (id)' from pg_constraint
   where conrelid = 'public.profiles'::regclass and contype = 'p'), 'profiles PK');
select pg_temp.assert_true(
  (select pg_get_constraintdef(oid) = 'PRIMARY KEY (user_id, certification_id)' from pg_constraint
   where conrelid = 'public.user_cert_progress'::regclass and contype = 'p'), 'composite progress PK');
select pg_temp.assert_true(
  (select count(*) = 2 from pg_constraint where contype = 'f'
   and conrelid in ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)
   and confrelid = 'auth.users'::regclass and confdeltype = 'c'), 'both auth FKs cascade');
select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(relrowsecurity) from pg_class
   where oid in ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)), 'RLS enabled');
select pg_temp.assert_true(
  (select count(*) = :expected_policy_count from pg_policy where polrelid in
    ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)), 'expected policy count for phase');
select pg_temp.assert_true(
  not exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname not in ('profiles', 'user_cert_progress')), 'only user data tables; no catalog');
select pg_temp.assert_true(
  (select count(*) = 2 from pg_index where indrelid in
    ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)), 'only PK indexes');

insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(
  not exists(select 1 from public.profiles), 'no automatic profile creation');
insert into public.profiles(id) values ('00000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(
  (select display_name is null and avatar_url is null and created_at = now() and updated_at = now()
   from public.profiles), 'nullable profile fields and timestamp defaults');

insert into public.user_cert_progress(user_id, certification_id, status)
select '00000000-0000-4000-8000-000000000001'::uuid, certification_id, status
from (values ('microsoft:ai-103', 'todo'), ('aws:saa-c03', 'planned'),
  ('anthropic:ccar-p', 'studying'), ('google-cloud:professional_data-engineer', 'done'),
  ('github:gh-900', 'todo'), ('new.provider_2:code.v1', 'planned')) as data(certification_id, status);
select pg_temp.assert_true(
  (select count(*) = 6 and bool_and(created_at = now() and updated_at = now())
   from public.user_cert_progress), 'all statuses, extensible IDs and timestamp defaults');

do $$
declare invalid_id text; invalid_status text;
begin
  foreach invalid_status in array array['invalid', 'DONE', '', ' done'] loop
    perform pg_temp.expect_error(format(
      'insert into public.user_cert_progress(user_id, certification_id, status) values (%L, %L, %L)',
      '00000000-0000-4000-8000-000000000001', 'microsoft:az-104', invalid_status), '23514');
  end loop;
  foreach invalid_id in array array['', 'ai-103', ':ai-103', 'microsoft:', 'Microsoft:ai-103',
    'microsoft:AI-103', 'microsoft:ai:103', 'microsoft:ai-103 ', ' microsoft:ai-103', 'microsoft:ai 103'] loop
    perform pg_temp.expect_error(format(
      'insert into public.user_cert_progress(user_id, certification_id, status) values (%L, %L, %L)',
      '00000000-0000-4000-8000-000000000001', invalid_id, 'todo'), '23514');
  end loop;
end;
$$;

select pg_temp.expect_error($q$insert into public.user_cert_progress(user_id, status)
  values ('00000000-0000-4000-8000-000000000001', 'todo')$q$, '23502');
select pg_temp.expect_error($q$insert into public.user_cert_progress(user_id, certification_id)
  values ('00000000-0000-4000-8000-000000000001', 'microsoft:az-104')$q$, '23502');
select pg_temp.expect_error($q$insert into public.profiles(id)
  values ('00000000-0000-4000-8000-000000000001')$q$, '23505');
select pg_temp.expect_error($q$insert into public.user_cert_progress(user_id, certification_id, status)
  values ('00000000-0000-4000-8000-000000000001', 'microsoft:ai-103', 'done')$q$, '23505');
select pg_temp.expect_error($q$insert into public.profiles(id)
  values ('00000000-0000-4000-8000-000000000099')$q$, '23503');
select pg_temp.expect_error($q$insert into public.user_cert_progress(user_id, certification_id, status)
  values ('00000000-0000-4000-8000-000000000099', 'microsoft:az-104', 'todo')$q$, '23503');

-- now() is constant within a transaction: use an earlier initial timestamp
-- to test that both triggers replace client-supplied timestamps with server time.
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000002');
insert into public.profiles(id, updated_at)
  values ('00000000-0000-4000-8000-000000000002', '2000-01-01Z');
insert into public.user_cert_progress(user_id, certification_id, status, updated_at)
  values ('00000000-0000-4000-8000-000000000002', 'microsoft:ai-103', 'todo', '2000-01-01Z');
update public.profiles set display_name = 'Updated', updated_at = '2001-01-01Z'
  where id = '00000000-0000-4000-8000-000000000002';
update public.user_cert_progress set status = 'done', updated_at = '2001-01-01Z'
  where user_id = '00000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(
  (select updated_at = now() and created_at = now() from public.profiles
   where id = '00000000-0000-4000-8000-000000000002'), 'profile trigger updates server timestamp');
select pg_temp.assert_true(
  (select updated_at = now() and created_at = now() from public.user_cert_progress
   where user_id = '00000000-0000-4000-8000-000000000002'), 'progress trigger updates server timestamp');

delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  not exists(select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.user_cert_progress where user_id = '00000000-0000-4000-8000-000000000001')
  and (select count(*) = 1 from public.user_cert_progress), 'cascade deletes only removed user data');

rollback;
\echo Schema validation passed; fixtures rolled back.
