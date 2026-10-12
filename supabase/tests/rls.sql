\set ON_ERROR_STOP on
-- Run via psql as administrator in an isolated database after P2 + P3.
-- Admin only creates Auth fixtures/checks metadata; user operations run as
-- authenticated/anon with request.jwt.claims, like PostgREST after JWT validation.
-- Helpers are SECURITY INVOKER. No user operation uses service_role or an owner.
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
  perform pg_temp.assert_true(caught_state = expected_state,
    format('SQLSTATE %s: %s (got %s)', expected_state, statement, caught_state));
end;
$$;

create function pg_temp.expect_rows(statement text, expected_count bigint)
returns void language plpgsql as $$
declare affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  perform pg_temp.assert_true(affected = expected_count,
    format('%s affected rows: %s', expected_count, statement));
end;
$$;

select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(relrowsecurity) from pg_class
   where oid in ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)),
  'RLS enabled on both tables');
select pg_temp.assert_true(
  (select count(*) = 8 and bool_and(polroles = array['authenticated'::regrole::oid])
    and bool_and(polcmd in ('r', 'a', 'w', 'd'))
    and bool_and(case polcmd
      when 'a' then polqual is null and polwithcheck is not null
      when 'w' then polqual is not null and polwithcheck is not null
      else polqual is not null and polwithcheck is null end)
   from pg_policy where polrelid in
     ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)),
  'exactly eight operation policies, authenticated only, with correct clauses');
select pg_temp.assert_true(
  (select not prosecdef and proconfig = array['search_path=pg_catalog']
   from pg_proc where oid = 'public.set_updated_at()'::regprocedure),
  'P2 trigger function is invoker with restricted search_path');
do $$
declare relation text; privilege text;
begin
  foreach relation in array array['public.profiles', 'public.user_cert_progress'] loop
    foreach privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      perform pg_temp.assert_true(not has_table_privilege('anon', relation, privilege),
        format('anon has no %s grant on %s', privilege, relation));
      perform pg_temp.assert_true(
        has_table_privilege('authenticated', relation, privilege) =
          (privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
        format('authenticated %s grant on %s', privilege, relation));
    end loop;
  end loop;
end;
$$;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-0000000000a3'),
  ('00000000-0000-4000-8000-0000000000b3');

set local role authenticated;
-- Do not set the legacy claim.sub GUC: exercise Supabase's JSON claims fallback.
do $$
declare me uuid;
begin
  perform pg_temp.assert_true(current_user = 'authenticated' and
    (select not rolsuper and not rolbypassrls from pg_roles where rolname = current_user)
    and not exists(select 1 from pg_class where oid in
      ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)
      and relowner = (current_user::regrole)::oid), 'real non-owner authenticated role, no RLS bypass');
  foreach me in array array[
    '00000000-0000-4000-8000-0000000000a3'::uuid,
    '00000000-0000-4000-8000-0000000000b3'::uuid] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', me, 'role', 'authenticated')::text, true);
    perform pg_temp.assert_true(auth.uid() = me, format('auth.uid() matches %s', me));
    perform pg_temp.expect_rows(format('insert into public.profiles(id, display_name) values (%L, %L)', me, 'Original'), 1);
    perform pg_temp.expect_rows(format('insert into public.user_cert_progress(user_id, certification_id, status) values (%L, %L, %L)', me, 'microsoft:ai-103', 'todo'), 1);
  end loop;
end;
$$;

do $$
declare me uuid; other_user uuid;
begin
  foreach me in array array[
    '00000000-0000-4000-8000-0000000000a3'::uuid,
    '00000000-0000-4000-8000-0000000000b3'::uuid] loop
    other_user := case when me = '00000000-0000-4000-8000-0000000000a3'::uuid
      then '00000000-0000-4000-8000-0000000000b3'::uuid
      else '00000000-0000-4000-8000-0000000000a3'::uuid end;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', me, 'role', 'authenticated')::text, true);
    perform pg_temp.assert_true(auth.uid() = me, format('isolation context %s', me));
    perform pg_temp.assert_true((select count(*) = 1 and bool_and(id = me) from public.profiles), 'unfiltered profile SELECT returns own row only');
    perform pg_temp.assert_true(not exists(select 1 from public.profiles where id = other_user), 'other profile invisible');
    perform pg_temp.expect_rows(format('update public.profiles set display_name = %L where id = %L', 'Updated', me), 1);
    perform pg_temp.assert_true((select display_name = 'Updated' from public.profiles where id = me), 'own profile updated');
    perform pg_temp.expect_error(format('insert into public.profiles(id) values (%L)', other_user), '42501');
    perform pg_temp.expect_rows(format('update public.profiles set display_name = %L where id = %L', 'Stolen', other_user), 0);
    perform pg_temp.expect_rows(format('delete from public.profiles where id = %L', other_user), 0);
    perform pg_temp.expect_error(format('update public.profiles set id = %L where id = %L', other_user, me), '42501');

    perform pg_temp.assert_true((select count(*) = 1 and bool_and(user_id = me) from public.user_cert_progress), 'unfiltered progress SELECT returns own row only');
    perform pg_temp.assert_true(not exists(select 1 from public.user_cert_progress where user_id = other_user), 'other progress invisible');
    perform pg_temp.expect_rows(format('update public.user_cert_progress set status = %L where user_id = %L', 'done', me), 1);
    perform pg_temp.assert_true((select status = 'done' from public.user_cert_progress where user_id = me), 'own progress updated');
    perform pg_temp.expect_error(format('insert into public.user_cert_progress(user_id, certification_id, status) values (%L, %L, %L)', other_user, 'microsoft:az-900', 'planned'), '42501');
    perform pg_temp.expect_rows(format('update public.user_cert_progress set status = %L where user_id = %L', 'studying', other_user), 0);
    perform pg_temp.expect_rows(format('delete from public.user_cert_progress where user_id = %L', other_user), 0);
    perform pg_temp.expect_error(format('update public.user_cert_progress set user_id = %L where user_id = %L', other_user, me), '42501');
    perform pg_temp.expect_error(format('insert into public.user_cert_progress(user_id, certification_id, status) values (%L, %L, %L) on conflict (user_id, certification_id) do update set status = excluded.status', other_user, 'microsoft:ai-103', 'studying'), '42501');
  end loop;
end;
$$;

-- Missing identity must fail closed even under authenticated.
set local request.jwt.claims = '{"role":"authenticated"}';
select pg_temp.assert_true(auth.uid() is null, 'missing sub gives null auth.uid()');
select pg_temp.assert_true(not exists(select 1 from public.profiles)
  and not exists(select 1 from public.user_cert_progress), 'missing sub sees no private rows');
select pg_temp.expect_error('insert into public.profiles(id) values (''00000000-0000-4000-8000-0000000000a3'')', '42501');
select pg_temp.expect_error('insert into public.user_cert_progress(user_id, certification_id, status) values (''00000000-0000-4000-8000-0000000000a3'', ''microsoft:az-900'', ''todo'')', '42501');
select pg_temp.expect_rows('update public.profiles set display_name = ''Stolen''', 0);
select pg_temp.expect_rows('delete from public.profiles', 0);
select pg_temp.expect_rows('update public.user_cert_progress set status = ''planned''', 0);
select pg_temp.expect_rows('delete from public.user_cert_progress', 0);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.assert_true(current_user = 'anon' and auth.uid() is null and
  (select not rolsuper and not rolbypassrls from pg_roles where rolname = current_user), 'anon context has no identity or bypass');
do $$
declare relation text;
begin
  foreach relation in array array['public.profiles', 'public.user_cert_progress'] loop
    perform pg_temp.expect_error(format('select * from %s', relation), '42501');
    perform pg_temp.expect_error(format('delete from %s', relation), '42501');
  end loop;
  perform pg_temp.expect_error('insert into public.profiles(id) values (''00000000-0000-4000-8000-0000000000a3'')', '42501');
  perform pg_temp.expect_error('update public.profiles set display_name = ''Stolen''', '42501');
  perform pg_temp.expect_error('insert into public.user_cert_progress(user_id, certification_id, status) values (''00000000-0000-4000-8000-0000000000a3'', ''microsoft:az-900'', ''todo'')', '42501');
  perform pg_temp.expect_error('update public.user_cert_progress set status = ''planned''', '42501');
end;
$$;
-- A sub alone must not confer authenticated privileges to anon.
set local request.jwt.claims = '{"role":"anon","sub":"00000000-0000-4000-8000-0000000000a3"}';
select pg_temp.expect_error('select * from public.profiles', '42501');
select pg_temp.expect_error('select * from public.user_cert_progress', '42501');

reset role;
select pg_temp.assert_true((select count(*) = 2 and bool_and(display_name = 'Updated') from public.profiles)
  and (select count(*) = 2 and bool_and(status = 'done') from public.user_cert_progress),
  'admin verification: both users survived all cross-user/anon attacks unchanged');

set local role authenticated;
do $$
declare me uuid;
begin
  foreach me in array array[
    '00000000-0000-4000-8000-0000000000a3'::uuid,
    '00000000-0000-4000-8000-0000000000b3'::uuid] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', me, 'role', 'authenticated')::text, true);
    perform pg_temp.expect_rows(format('delete from public.profiles where id = %L', me), 1);
    perform pg_temp.assert_true((select count(*) = 1 from public.user_cert_progress), 'deleting own profile preserves own progress');
    perform pg_temp.expect_rows(format('delete from public.user_cert_progress where user_id = %L', me), 1);
  end loop;
end;
$$;
reset role;
select pg_temp.assert_true(not exists(select 1 from public.profiles)
  and not exists(select 1 from public.user_cert_progress), 'own DELETE succeeded for both users');
rollback;
\echo RLS isolation validation passed; fixtures and test helpers rolled back.
