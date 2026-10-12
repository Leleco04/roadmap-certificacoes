\set ON_ERROR_STOP on
-- ONLY an empty disposable PostgreSQL database, run as its administrator.
-- Supabase CLI alternative: apply migrations, then run rls.sql via psql.
create schema auth;
create table auth.users (id uuid primary key);
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create role service_role nologin nosuperuser bypassrls;

-- Supabase Auth implementation, not a constant UUID mock:
-- https://github.com/supabase/auth/blob/master/migrations/20211202183645_update_auth_uid.up.sql
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  ), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

\ir ../migrations/20261008000000_create_user_data.sql
-- Simulate legacy Supabase default grants, including privileges outside RLS.
grant all on public.profiles, public.user_cert_progress to anon, authenticated, service_role;
\ir schema.sql
create temporary table service_grants_before as
  select c.oid, acl.* from pg_class c cross join lateral aclexplode(c.relacl) acl
  where c.oid in ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)
    and acl.grantee = 'service_role'::regrole::oid;
\ir ../migrations/20261010000000_create_rls_policies.sql
-- Compare service_role's direct ACL entries; never run user operations as it.
do $$
begin
  if exists (
    (select * from service_grants_before
     except
     select c.oid, acl.* from pg_class c cross join lateral aclexplode(c.relacl) acl
     where c.oid in ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)
       and acl.grantee = 'service_role'::regrole::oid)
    union all
    (select c.oid, acl.* from pg_class c cross join lateral aclexplode(c.relacl) acl
     where c.oid in ('public.profiles'::regclass, 'public.user_cert_progress'::regclass)
       and acl.grantee = 'service_role'::regrole::oid
     except
     select * from service_grants_before)
  ) then
    raise exception 'service_role privileges changed';
  end if;
  raise notice 'PASS: service_role ACL unchanged';
end;
$$;
drop table service_grants_before;
\set expected_policy_count 8
\ir schema.sql
\ir rls.sql
