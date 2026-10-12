\set ON_ERROR_STOP on
-- ONLY a fresh disposable PostgreSQL database, owned by the test operator.
-- Minimal auth.users fixture supplies the external FK target; this is not Auth.
-- On a real local Supabase database, apply migrations and run schema.sql directly.
create schema auth;
create table auth.users (id uuid primary key);
\ir ../migrations/20261008000000_create_user_data.sql
\ir schema.sql
