-- Create artwork storage bucket (public reads, authenticated uploads)
insert into storage.buckets (id, name, public)
values ('artwork', 'artwork', true)
on conflict (id) do nothing;

-- Public reads for artwork
create policy "Public artwork reads" on storage.objects
  for select using (bucket_id = 'artwork');

-- Authenticated users can upload artwork
create policy "Authenticated users upload artwork" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artwork');

-- Users can delete their own artwork (cleanup)
create policy "Users delete own artwork" on storage.objects
  for delete to authenticated
  using (bucket_id = 'artwork' and owner_id = auth.uid()::text);

-- Allow authenticated players to insert creature_moves for their own creatures.
-- Without this policy, only admins could add moves to creatures (RLS blocks it).
create policy "users insert own creature_moves" on creature_moves
  for insert
  with check (
    exists (
      select 1 from creatures
      where creatures.id = creature_id
        and creatures.creator_id = auth.uid()
    )
  );
