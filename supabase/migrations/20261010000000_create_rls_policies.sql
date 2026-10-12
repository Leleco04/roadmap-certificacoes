-- P3 only: private user data. Requires the P2 schema and Supabase roles/auth.uid().
begin;

alter table public.profiles enable row level security;
alter table public.user_cert_progress enable row level security;

-- Remove client privileges that could bypass row policies (for example TRUNCATE).
-- service_role privileges are intentionally untouched.
revoke all on table public.profiles, public.user_cert_progress from public, anon, authenticated;
grant select, insert, update, delete on table public.profiles, public.user_cert_progress to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Deleting a profile does not delete the Auth account or its progress.
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (auth.uid() = id);

create policy user_cert_progress_select_own on public.user_cert_progress
  for select to authenticated using (auth.uid() = user_id);
create policy user_cert_progress_insert_own on public.user_cert_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_cert_progress_update_own on public.user_cert_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_cert_progress_delete_own on public.user_cert_progress
  for delete to authenticated using (auth.uid() = user_id);

commit;
