-- Requires the auth.users table supplied by Supabase. Catalog stays in src/catalog.
begin;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_cert_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  certification_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, certification_id),
  constraint user_cert_progress_identity_check check (
    certification_id collate "C" ~ '^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$'
  ),
  constraint user_cert_progress_status_check check (
    status in ('todo', 'planned', 'studying', 'done')
  )
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_cert_progress_set_updated_at
before update on public.user_cert_progress
for each row execute function public.set_updated_at();

-- Safe structural default only. P3 supplies and tests the access policies.
alter table public.profiles enable row level security;
alter table public.user_cert_progress enable row level security;

-- Composite PK already supports user_id and user_id + certification_id lookups.
-- Additional sync/status indexes will depend on measured queries in P5.
commit;
