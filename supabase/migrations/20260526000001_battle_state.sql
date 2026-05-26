-- Add battle_state JSONB column to battles table
alter table battles add column battle_state jsonb;

-- Players can create battles (as challenger)
create policy "players create battles" on battles
  for insert to authenticated
  with check (challenger_id = auth.uid());

-- Players can update their own active battles (turn submission updates state)
create policy "players update own battles" on battles
  for update to authenticated
  using (challenger_id = auth.uid());

-- Players can insert their own battle_teams
create policy "players insert own battle_teams" on battle_teams
  for insert to authenticated
  with check (user_id = auth.uid());

-- Players can insert turns for battles they own
-- acting_user_id = auth.uid() would block AI turn rows, so check battle ownership instead
create policy "players insert own battle_turns" on battle_turns
  for insert to authenticated
  with check (
    exists (
      select 1 from battles
      where battles.id = battle_id
        and battles.challenger_id = auth.uid()
    )
  );
