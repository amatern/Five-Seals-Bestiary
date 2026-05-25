-- Fix infinite recursion in admin RLS policies.
--
-- The original admin policies used a direct subquery against the users table:
--   exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
--
-- When PostgreSQL evaluates the "admins full users" policy on the users table,
-- the subquery itself reads from users — triggering the same policy again → infinite loop.
--
-- Fix: a security definer function that runs as the function owner (bypassing RLS),
-- so the users table is read without triggering the policy on users.

drop policy if exists "admins full creatures"         on creatures;
drop policy if exists "admins full trainers"          on trainers;
drop policy if exists "admins full trainer_creatures" on trainer_creatures;
drop policy if exists "admins full campaign_gates"    on campaign_gates;
drop policy if exists "admins full users"             on users;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from users where id = auth.uid() and is_admin = true
  )
$$;

create policy "admins full creatures"         on creatures         for all using (is_admin());
create policy "admins full trainers"          on trainers          for all using (is_admin());
create policy "admins full trainer_creatures" on trainer_creatures for all using (is_admin());
create policy "admins full campaign_gates"    on campaign_gates    for all using (is_admin());
create policy "admins full users"             on users             for all using (is_admin());
