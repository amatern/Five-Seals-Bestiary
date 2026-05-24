create extension if not exists "pgcrypto";

-- CAMPAIGN GATES
create table campaign_gates (
  key         text primary key,
  label       text not null,
  description text not null,
  unlocked    boolean not null default false,
  unlocked_at timestamptz
);

-- USERS
create table users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  username   text unique not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- CREATURES
create table creatures (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  types       text[] not null,
  flavor_text text not null,
  hp          int not null check (hp > 0),
  atk         int not null check (atk > 0),
  def         int not null check (def > 0),
  spd         int not null check (spd > 0),
  origin      text not null check (origin in ('canon','player-designed','admin-designed')),
  creator_id  uuid references users(id) on delete set null,
  artwork_url text,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- MOVES
create table moves (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  type          text not null,
  power         int,
  move_type     text not null check (move_type in ('attack','status')),
  status_effect text check (status_effect in ('atk_down','def_up','spd_down','drain')),
  description   text not null,
  constraint status_move_has_effect
    check (move_type = 'attack' or status_effect is not null)
);

-- CREATURE MOVES
create table creature_moves (
  creature_id uuid not null references creatures(id) on delete cascade,
  move_id     uuid not null references moves(id) on delete cascade,
  slot        int not null check (slot between 1 and 4),
  primary key (creature_id, slot)
);

-- TRAINERS
create table trainers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null,
  intro_text  text not null,
  win_text    text not null,
  loss_text   text not null,
  ai_behavior text not null check (ai_behavior in ('aggressive','defensive','balanced')),
  gate_key    text references campaign_gates(key) on delete set null,
  created_at  timestamptz not null default now()
);

-- TRAINER CREATURES
create table trainer_creatures (
  trainer_id  uuid not null references trainers(id) on delete cascade,
  creature_id uuid not null references creatures(id) on delete cascade,
  slot        int not null check (slot between 1 and 6),
  primary key (trainer_id, slot)
);

-- BATTLES
create table battles (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('vs-ai','pvp')),
  challenger_id uuid not null references users(id) on delete cascade,
  opponent_id   uuid references users(id) on delete cascade,
  trainer_id    uuid references trainers(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending','active','complete')),
  winner_id     uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint battle_type_consistency check (
    (type = 'vs-ai' and trainer_id is not null and opponent_id is null) or
    (type = 'pvp' and opponent_id is not null and trainer_id is null)
  )
);

-- BATTLE TEAMS
create table battle_teams (
  battle_id   uuid not null references battles(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  creature_id uuid not null references creatures(id) on delete cascade,
  slot        int not null check (slot between 1 and 6),
  primary key (battle_id, user_id, slot)
);

-- BATTLE TURNS
create table battle_turns (
  id             uuid primary key default gen_random_uuid(),
  battle_id      uuid not null references battles(id) on delete cascade,
  turn_number    int not null,
  acting_user_id uuid references users(id) on delete cascade,
  creature_id    uuid not null references creatures(id) on delete cascade,
  move_id        uuid not null references moves(id) on delete cascade,
  damage         int,
  effectiveness  text check (effectiveness in ('strong','neutral','weak')),
  chronicle_text text not null,
  submitted_at   timestamptz not null default now()
);

-- TYPE EFFECTIVENESS
create table type_effectiveness (
  attacking_type text not null,
  defending_type text not null,
  modifier       numeric(3,1) not null check (modifier in (0.5, 1.0, 2.0)),
  primary key (attacking_type, defending_type)
);

-- ROW LEVEL SECURITY
alter table users enable row level security;
alter table creatures enable row level security;
alter table moves enable row level security;
alter table creature_moves enable row level security;
alter table trainers enable row level security;
alter table trainer_creatures enable row level security;
alter table battles enable row level security;
alter table battle_teams enable row level security;
alter table battle_turns enable row level security;
alter table campaign_gates enable row level security;
alter table type_effectiveness enable row level security;

-- Public read policies
create policy "public read approved creatures" on creatures for select using (approved = true);
create policy "public read moves" on moves for select using (true);
create policy "public read creature_moves" on creature_moves for select using (true);
create policy "public read trainers" on trainers for select using (true);
create policy "public read trainer_creatures" on trainer_creatures for select using (true);
create policy "public read campaign_gates" on campaign_gates for select using (true);
create policy "public read type_effectiveness" on type_effectiveness for select using (true);
create policy "public read users" on users for select using (true);

-- Authenticated user policies
create policy "users read own battles" on battles for select
  using (challenger_id = auth.uid() or opponent_id = auth.uid());
create policy "users read own battle_teams" on battle_teams for select
  using (user_id = auth.uid());
create policy "users read own battle_turns" on battle_turns for select
  using (exists (
    select 1 from battles
    where battles.id = battle_id
    and (battles.challenger_id = auth.uid() or battles.opponent_id = auth.uid())
  ));
create policy "users insert own profile" on users for insert with check (id = auth.uid());
create policy "users update own profile" on users for update using (id = auth.uid());
create policy "users insert own creatures" on creatures for insert with check (creator_id = auth.uid());
create policy "users update own unapproved creatures" on creatures for update
  using (creator_id = auth.uid() and approved = false);

-- Admin full-access policies
create policy "admins full creatures" on creatures for all using (
  exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
);
create policy "admins full trainers" on trainers for all using (
  exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
);
create policy "admins full trainer_creatures" on trainer_creatures for all using (
  exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
);
create policy "admins full campaign_gates" on campaign_gates for all using (
  exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
);
create policy "admins full users" on users for all using (
  exists (select 1 from users where users.id = auth.uid() and users.is_admin = true)
);
