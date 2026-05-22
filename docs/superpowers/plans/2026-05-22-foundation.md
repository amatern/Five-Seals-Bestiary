# Five Seals Bestiary — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js project, create all database tables, seed canon creature data, set up magic-link auth, and deploy a working title screen to Vercel.

**Architecture:** Next.js 14 App Router + TypeScript + Tailwind CSS, connected to Supabase for Postgres + Auth + Storage. Supabase CLI manages schema migrations. All secrets in environment variables.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, `@supabase/ssr`, Vitest, Playwright

---

This is Plan 1 of 6. At the end you will have: a running Next.js app with a title screen, all database tables created and seeded with canon creatures, magic-link auth working, and a live Vercel deployment.

Plans 2–6 cover: Bestiary, The Forge, Battle System, Admin Panel, PvP & Profiles.

---

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json` (auto-generated)
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Create the Next.js app**

Run from inside your cloned GitHub repo directory:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Expected: Next.js project files created in current directory.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk openai
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom supabase
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Create tests/setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add scripts to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

- [ ] **Step 7: Add to .gitignore**

Append to `.gitignore`:
```
.env.local
.env.*.local
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000 — default Next.js page should appear.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with Supabase and Vitest"
```

---

### Task 2: Database schema

**Files:**
- Create: `supabase/config.toml` (auto-generated)
- Create: `supabase/migrations/YYYYMMDDHHMMSS_initial.sql`

**Prerequisites:** Create a Supabase project at https://supabase.com. Copy `.env.local.example` to `.env.local` and fill in values from Supabase dashboard → Settings → API.

- [ ] **Step 1: Initialize Supabase**

```bash
npx supabase init
```

- [ ] **Step 2: Link to your project**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is in the Supabase dashboard URL: `supabase.com/dashboard/project/YOUR_PROJECT_REF`

- [ ] **Step 3: Create migration file**

```bash
npx supabase migration new initial
```

- [ ] **Step 4: Write the migration**

Open the created file in `supabase/migrations/` and replace its contents:

```sql
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
```

- [ ] **Step 5: Apply the migration**

```bash
npx supabase db push
```

Expected: "Applying migration... done"

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: database schema with RLS policies"
```

---

### Task 3: Seed canon data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed.sql**

Create `supabase/seed.sql`:

```sql
-- CAMPAIGN GATES
insert into campaign_gates (key, label, description, unlocked) values
  ('always',           'Always Available',         'Starter content available from day one', true),
  ('seal-of-water',    'Seal of Water Threatened',  'Thessalmar revealed; Drowned Reliquary appears', false),
  ('stormcrest-spire', 'Stormcrest Spire Reached',  'Silvaclaw hunts; Stormcrest Sentinel appears', false),
  ('radiant-temple',   'Radiant Temple Corrupted',  'Vexmire closes in; Hollow Saint appears', false),
  ('umbral-vault',     'Umbral Vault Compromised',   'Nyx revealed; Shadow-touched Monk appears', false),
  ('five-seals-broken','Five Seals Broken',          'Infernadax becomes battleable', false)
on conflict (key) do nothing;

-- TYPE EFFECTIVENESS
insert into type_effectiveness (attacking_type, defending_type, modifier) values
  ('Fiendish',   'Fiendish',   1.0), ('Fiendish',   'Elemental',  2.0), ('Fiendish',   'Undead',     0.5),
  ('Fiendish',   'Celestial',  0.5), ('Fiendish',   'Aberration', 1.0), ('Fiendish',   'Arcane',     1.0),
  ('Fiendish',   'Fey',        1.0), ('Fiendish',   'Beast',      1.0),
  ('Elemental',  'Fiendish',   0.5), ('Elemental',  'Elemental',  1.0), ('Elemental',  'Undead',     2.0),
  ('Elemental',  'Celestial',  1.0), ('Elemental',  'Aberration', 1.0), ('Elemental',  'Arcane',     0.5),
  ('Elemental',  'Fey',        1.0), ('Elemental',  'Beast',      2.0),
  ('Undead',     'Fiendish',   2.0), ('Undead',     'Elemental',  0.5), ('Undead',     'Undead',     0.5),
  ('Undead',     'Celestial',  2.0), ('Undead',     'Aberration', 1.0), ('Undead',     'Arcane',     1.0),
  ('Undead',     'Fey',        0.5), ('Undead',     'Beast',      1.0),
  ('Celestial',  'Fiendish',   2.0), ('Celestial',  'Elemental',  1.0), ('Celestial',  'Undead',     2.0),
  ('Celestial',  'Celestial',  0.5), ('Celestial',  'Aberration', 0.5), ('Celestial',  'Arcane',     1.0),
  ('Celestial',  'Fey',        1.0), ('Celestial',  'Beast',      0.5),
  ('Aberration', 'Fiendish',   1.0), ('Aberration', 'Elemental',  1.0), ('Aberration', 'Undead',     0.5),
  ('Aberration', 'Celestial',  2.0), ('Aberration', 'Aberration', 0.5), ('Aberration', 'Arcane',     2.0),
  ('Aberration', 'Fey',        1.0), ('Aberration', 'Beast',      0.5),
  ('Arcane',     'Fiendish',   0.5), ('Arcane',     'Elemental',  2.0), ('Arcane',     'Undead',     1.0),
  ('Arcane',     'Celestial',  0.5), ('Arcane',     'Aberration', 2.0), ('Arcane',     'Arcane',     0.5),
  ('Arcane',     'Fey',        2.0), ('Arcane',     'Beast',      1.0),
  ('Fey',        'Fiendish',   1.0), ('Fey',        'Elemental',  0.5), ('Fey',        'Undead',     2.0),
  ('Fey',        'Celestial',  1.0), ('Fey',        'Aberration', 1.0), ('Fey',        'Arcane',     2.0),
  ('Fey',        'Fey',        0.5), ('Fey',        'Beast',      0.5),
  ('Beast',      'Fiendish',   0.5), ('Beast',      'Elemental',  0.5), ('Beast',      'Undead',     1.0),
  ('Beast',      'Celestial',  1.0), ('Beast',      'Aberration', 2.0), ('Beast',      'Arcane',     1.0),
  ('Beast',      'Fey',        2.0), ('Beast',      'Beast',      0.5)
on conflict (attacking_type, defending_type) do nothing;

-- MOVES
insert into moves (id, name, type, power, move_type, status_effect, description) values
  ('m0001-0000-0000-0000-000000000001', 'Ember Breath',        'Elemental', 60,   'attack', null,       'The creature exhaled, and the air itself caught.'),
  ('m0001-0000-0000-0000-000000000002', 'Ash Shroud',          'Elemental', null, 'status', 'def_up',   'Ash settled over it like a cloak. Nothing came through.'),
  ('m0001-0000-0000-0000-000000000003', 'Infernal Roar',       'Fiendish',  70,   'attack', null,       'The roar shook stone from the ceiling.'),
  ('m0001-0000-0000-0000-000000000004', 'Tail Lash',           'Beast',     50,   'attack', null,       'The tail struck without warning.'),
  ('m0001-0000-0000-0000-000000000005', 'Drowning Tide',       'Elemental', 75,   'attack', null,       'The tide rose, and what it covered did not resurface.'),
  ('m0001-0000-0000-0000-000000000006', 'Lightning Lance',     'Elemental', 85,   'attack', null,       'Even beneath the water, the lightning found its mark.'),
  ('m0001-0000-0000-0000-000000000007', 'Sundering Roar',      'Fiendish',  65,   'attack', null,       'The sound alone unmade something in the defender.'),
  ('m0001-0000-0000-0000-000000000008', 'Brackish Hymn',       'Aberration',null, 'status', 'spd_down', 'The hymn filled the water. Movement became difficult.'),
  ('m0001-0000-0000-0000-000000000009', 'Frost Breath',        'Elemental', 60,   'attack', null,       'The breath turned the air to glass.'),
  ('m0001-0000-0000-0000-000000000010', 'Avalanche',           'Elemental', 90,   'attack', null,       'The mountain remembered every slight.'),
  ('m0001-0000-0000-0000-000000000011', 'Yetic Howl',          'Beast',     null, 'status', 'atk_down', 'The howl carried something that dulled the senses.'),
  ('m0001-0000-0000-0000-000000000012', 'Hungering Cold',      'Elemental', 70,   'attack', null,       'The cold did not kill. It made the victim want to stop fighting.'),
  ('m0001-0000-0000-0000-000000000013', 'Acid Veil',           'Elemental', 65,   'attack', null,       'The veil fell, and what it touched came apart.'),
  ('m0001-0000-0000-0000-000000000014', 'Dawnsbane Bite',      'Fiendish',  80,   'attack', null,       'It remembered the light, and hated it.'),
  ('m0001-0000-0000-0000-000000000015', 'Hollow Gaze',         'Undead',    null, 'status', 'atk_down', 'The gaze emptied something. The will to strike wavered.'),
  ('m0001-0000-0000-0000-000000000016', 'Centuries'' Spite',   'Fiendish',  95,   'attack', null,       'Three hundred years of patience, released at once.'),
  ('m0001-0000-0000-0000-000000000017', 'Whispering Strike',   'Fey',       65,   'attack', null,       'The strike came from a direction that had not existed a moment before.'),
  ('m0001-0000-0000-0000-000000000018', 'Doppelganger''s Gift','Fey',       null, 'status', 'def_up',   'For a moment, it looked like someone else. The hesitation was enough.'),
  ('m0001-0000-0000-0000-000000000019', 'Twilight Veil',       'Fey',       null, 'status', 'spd_down', 'The veil between moments thickened.'),
  ('m0001-0000-0000-0000-000000000020', 'Treachery''s Bite',   'Fey',       85,   'attack', null,       'It struck with the force of a broken promise.'),
  ('m0001-0000-0000-0000-000000000021', 'Eternal Flame Breath','Elemental', 110,  'attack', null,       'The fire was older than the mountain. It remembered what it had burned before.'),
  ('m0001-0000-0000-0000-000000000022', 'Frightful Presence',  'Fiendish',  null, 'status', 'atk_down', 'The presence alone unmade the will to resist.'),
  ('m0001-0000-0000-0000-000000000023', 'Heraldic Roar',       'Fiendish',  80,   'attack', null,       'The Herald announced itself. The announcement was a weapon.'),
  ('m0001-0000-0000-0000-000000000024', 'Tail of the Mountain','Beast',     90,   'attack', null,       'The tail swept like an avalanche that had learned to hate.'),
  ('m0001-0000-0000-0000-000000000025', 'Cultist''s Blade',    'Beast',     40,   'attack', null,       'The blade was ordinary. The hand holding it was not.'),
  ('m0001-0000-0000-0000-000000000026', 'Zealot''s Cry',       'Fiendish',  null, 'status', 'atk_down', 'The cry carried a word in Draconic that stripped courage from the air.'),
  ('m0001-0000-0000-0000-000000000027', 'Brand of the Wyrm',   'Fiendish',  55,   'attack', null,       'The brand on their skin discharged. The target felt it twice.'),
  ('m0001-0000-0000-0000-000000000028', 'Fang Strike',         'Fiendish',  60,   'attack', null,       'Faster than it had any right to be.'),
  ('m0001-0000-0000-0000-000000000029', 'Wyrm''s Favor',       'Fiendish',  null, 'status', 'def_up',   'The favor of the dragon settled over it. For a moment, nothing could touch it.'),
  ('m0001-0000-0000-0000-000000000030', 'Smoldering Stance',   'Elemental', null, 'status', 'atk_down', 'The stance drew heat from the air and forced it inward.'),
  ('m0001-0000-0000-0000-000000000031', 'Tongue of Dragons',   'Arcane',    70,   'attack', null,       'The word landed like a physical thing.'),
  ('m0001-0000-0000-0000-000000000032', 'Heralded Word',       'Arcane',    null, 'status', 'spd_down', 'The word unwound time slightly. Movement slowed.'),
  ('m0001-0000-0000-0000-000000000033', 'Burning Sermon',      'Fiendish',  75,   'attack', null,       'The sermon was a weapon. Every syllable burned.'),
  ('m0001-0000-0000-0000-000000000034', 'Ashen Touch',         'Elemental', 50,   'attack', null,       'The touch left ash where it landed.'),
  ('m0001-0000-0000-0000-000000000035', 'Smoldering Wail',     'Undead',    60,   'attack', null,       'The wail carried embers.'),
  ('m0001-0000-0000-0000-000000000036', 'Cinder Cloak',        'Elemental', null, 'status', 'def_up',   'The cloak of cinders deflected the blow.'),
  ('m0001-0000-0000-0000-000000000037', 'Names of the Drowned','Aberration',65,   'attack', null,       'The names came out of the water. They knew where to land.'),
  ('m0001-0000-0000-0000-000000000038', 'Brackish Embrace',    'Aberration',70,   'attack', null,       'It pulled the target into water that was not there a moment ago.'),
  ('m0001-0000-0000-0000-000000000039', 'Reliquary''s Curse',  'Aberration',null, 'status', 'spd_down', 'The curse sealed into bone. Movement became a question.'),
  ('m0001-0000-0000-0000-000000000040', 'Silent Prayer',       'Celestial', null, 'status', 'drain',    'The prayer asked for nothing. Something answered anyway.'),
  ('m0001-0000-0000-0000-000000000041', 'Hollow Light',        'Celestial', 60,   'attack', null,       'The light was wrong. It cast shadows in directions that did not exist.'),
  ('m0001-0000-0000-0000-000000000042', 'Vestment of Ash',     'Undead',    null, 'status', 'def_up',   'The vestments held. They had held for three hundred years.'),
  ('m0001-0000-0000-0000-000000000043', 'Stormcaller''s Strike','Elemental',65,   'attack', null,       'The strike carried the weight of the storm above.'),
  ('m0001-0000-0000-0000-000000000044', 'Avalanche Charge',    'Beast',     80,   'attack', null,       'The charge moved like something inevitable.'),
  ('m0001-0000-0000-0000-000000000045', 'Lightning Mane',      'Elemental', 70,   'attack', null,       'The mane discharged. The lightning had nowhere else to go.'),
  ('m0001-0000-0000-0000-000000000046', 'Twilight Strike',     'Fey',       60,   'attack', null,       'The strike came from the seam between moments.'),
  ('m0001-0000-0000-0000-000000000047', 'Veiled Step',         'Fey',       null, 'status', 'spd_down', 'The step folded something in the defender.'),
  ('m0001-0000-0000-0000-000000000048', 'Whisper of the Vault','Fey',       65,   'attack', null,       'The whisper knew what it was looking for.'),
  ('m0001-0000-0000-0000-000000000049', 'Hatchling''s Bite',   'Beast',     35,   'attack', null,       'Full-formed and full of hunger from the first moment.'),
  ('m0001-0000-0000-0000-000000000050', 'Untaught Breath',     'Elemental', 45,   'attack', null,       'It did not know what it was doing. That made it unpredictable.'),
  ('m0001-0000-0000-0000-000000000051', 'Newborn''s Cry',      'Beast',     null, 'status', 'atk_down', 'The cry had no refinement. It did not need any.'),
  ('m0001-0000-0000-0000-000000000052', 'Heat Sight',          'Fiendish',  null, 'status', 'atk_down', 'It saw where the blood ran hottest. The knowledge unnerved.'),
  ('m0001-0000-0000-0000-000000000053', 'Glaive Strike',       'Beast',     65,   'attack', null,       'The plasma glaive made no sound. The impact made plenty.'),
  ('m0001-0000-0000-0000-000000000054', 'Heralded Cry',        'Fiendish',  55,   'attack', null,       'The cry announced a patron whose name was fire.')
on conflict (name) do nothing;

-- CREATURES
insert into creatures (id, name, types, flavor_text, hp, atk, def, spd, origin, approved) values
  ('c0001-0000-0000-0000-000000000001','Thessalmar the Drowned',
   ARRAY['Elemental','Aberration'],
   'Two centuries beneath the depths have taught the Drowned patience. It does not strike first. It waits until the lungs fail.',
   140,95,90,60,'canon',true),
  ('c0001-0000-0000-0000-000000000002','Silvaclaw the Storm Eater',
   ARRAY['Elemental','Beast'],
   'It eats the storms themselves, leaving the giants to face still skies and silent thunder. Three of the eight are already dead.',
   120,100,70,95,'canon',true),
  ('c0001-0000-0000-0000-000000000003','Vexmire the Dawnsbane',
   ARRAY['Fiendish','Undead'],
   'It was there at the first sealing. It remembers the Radiant One''s face. It has not forgiven her, and her death three centuries ago was insufficient.',
   130,110,80,65,'canon',true),
  ('c0001-0000-0000-0000-000000000004','Nyx the Shadow Fang',
   ARRAY['Fey','Aberration'],
   'No one has seen its true form in a generation. The monks who tend the vault swear it is one of them — and they are not wrong, but they are not right.',
   125,90,85,90,'canon',true),
  ('c0001-0000-0000-0000-000000000005','Infernadax the Eternal Flame',
   ARRAY['Fiendish','Elemental'],
   'Three centuries beneath the mountain have not cooled him. They have only sharpened him. He waits, and he remembers, and he speaks to those who would listen — and many do.',
   200,150,120,80,'canon',false),
  ('c0001-0000-0000-0000-000000000006','Crimson Wyrmling',
   ARRAY['Beast','Elemental'],
   'They do not hatch. They simply appear, full-formed and full of hunger, in places where the veil has thinned.',
   50,55,40,60,'canon',true),
  ('c0001-0000-0000-0000-000000000007','Brackish Wyrmling',
   ARRAY['Beast','Aberration'],
   'Found in the flooded places where the Seal of Water weeps. It smells of brine and older things.',
   50,50,45,55,'canon',true),
  ('c0001-0000-0000-0000-000000000008','Storm Wyrmling',
   ARRAY['Beast','Elemental'],
   'The giants found the first one in the pass above Stormcrest. They killed it. Three more appeared the following morning.',
   50,60,35,70,'canon',true),
  ('c0001-0000-0000-0000-000000000009','Verdant Wyrmling',
   ARRAY['Beast','Fey'],
   'It appeared in the monastery garden. The monks did not notice it did not belong until it had been there a week.',
   50,50,50,55,'canon',true),
  ('c0001-0000-0000-0000-000000000010','Shadowborn Wyrmling',
   ARRAY['Beast','Fey'],
   'It casts no shadow. When asked what it casts instead, the scholars declined to answer.',
   50,52,48,60,'canon',true),
  ('c0001-0000-0000-0000-000000000011','Half-dragon Servant',
   ARRAY['Fiendish','Beast'],
   'A bargain struck in flame leaves marks on the body and the soul. These bear both, and serve their patron with equal fervor.',
   70,65,55,60,'canon',true),
  ('c0001-0000-0000-0000-000000000012','Dragonclaw',
   ARRAY['Beast','Fiendish'],
   'They were farmers, last year. The dreams came, and they understood.',
   45,45,40,50,'canon',true),
  ('c0001-0000-0000-0000-000000000013','Dragon Fang',
   ARRAY['Fiendish','Beast'],
   'Their teeth grow long. Their eyes grow yellow. They do not notice, or they do not mind.',
   65,65,55,55,'canon',true),
  ('c0001-0000-0000-0000-000000000014','Wyrmspeaker',
   ARRAY['Arcane','Fiendish'],
   'Five Wyrmspeakers walk the Sword Coast, and each speaks for one head of the Queen.',
   70,70,50,60,'canon',true),
  ('c0001-0000-0000-0000-000000000015','Ash Wraith',
   ARRAY['Undead','Elemental'],
   'Some deaths are too sudden for the soul to follow. The ash remembers what the body forgot.',
   60,60,45,70,'canon',true),
  ('c0001-0000-0000-0000-000000000016','Drowned Reliquary',
   ARRAY['Aberration','Elemental'],
   'A vessel of bone and brackish water, sealed by some forgotten rite. It is full of names. When it opens, the names come out in the voices that first spoke them.',
   75,65,60,40,'canon',true),
  ('c0001-0000-0000-0000-000000000017','Hollow Saint',
   ARRAY['Undead','Celestial'],
   'What is left of a cleric who refused to die. It still wears the vestments of the Order, though the cloth has long since turned to ash. Its prayers are silent now, but the words still move its jaw.',
   70,55,65,45,'canon',true),
  ('c0001-0000-0000-0000-000000000018','Stormcrest Sentinel',
   ARRAY['Elemental','Beast'],
   'The giants do not command them. The giants merely walk among them, and the sentinels do not interfere.',
   80,70,70,55,'canon',true),
  ('c0001-0000-0000-0000-000000000019','Shadow-touched Monk',
   ARRAY['Fey','Aberration'],
   'They still wear the robes. They still walk the cloister. Something else moves behind their eyes.',
   65,60,60,75,'canon',true),
  ('c0001-0000-0000-0000-000000000020','Cinderwyrm',
   ARRAY['Fiendish','Elemental'],
   'A wyrm born in the ashes of the Second Seal''s breaking. Its scales smolder even after death.',
   70,75,60,65,'canon',true)
on conflict (id) do nothing;

-- CREATURE MOVES
insert into creature_moves (creature_id, move_id, slot) values
  -- Thessalmar
  ('c0001-0000-0000-0000-000000000001','m0001-0000-0000-0000-000000000005',1),
  ('c0001-0000-0000-0000-000000000001','m0001-0000-0000-0000-000000000006',2),
  ('c0001-0000-0000-0000-000000000001','m0001-0000-0000-0000-000000000007',3),
  ('c0001-0000-0000-0000-000000000001','m0001-0000-0000-0000-000000000008',4),
  -- Silvaclaw
  ('c0001-0000-0000-0000-000000000002','m0001-0000-0000-0000-000000000009',1),
  ('c0001-0000-0000-0000-000000000002','m0001-0000-0000-0000-000000000010',2),
  ('c0001-0000-0000-0000-000000000002','m0001-0000-0000-0000-000000000011',3),
  ('c0001-0000-0000-0000-000000000002','m0001-0000-0000-0000-000000000012',4),
  -- Vexmire
  ('c0001-0000-0000-0000-000000000003','m0001-0000-0000-0000-000000000013',1),
  ('c0001-0000-0000-0000-000000000003','m0001-0000-0000-0000-000000000014',2),
  ('c0001-0000-0000-0000-000000000003','m0001-0000-0000-0000-000000000015',3),
  ('c0001-0000-0000-0000-000000000003','m0001-0000-0000-0000-000000000016',4),
  -- Nyx
  ('c0001-0000-0000-0000-000000000004','m0001-0000-0000-0000-000000000017',1),
  ('c0001-0000-0000-0000-000000000004','m0001-0000-0000-0000-000000000018',2),
  ('c0001-0000-0000-0000-000000000004','m0001-0000-0000-0000-000000000019',3),
  ('c0001-0000-0000-0000-000000000004','m0001-0000-0000-0000-000000000020',4),
  -- Infernadax
  ('c0001-0000-0000-0000-000000000005','m0001-0000-0000-0000-000000000021',1),
  ('c0001-0000-0000-0000-000000000005','m0001-0000-0000-0000-000000000022',2),
  ('c0001-0000-0000-0000-000000000005','m0001-0000-0000-0000-000000000023',3),
  ('c0001-0000-0000-0000-000000000005','m0001-0000-0000-0000-000000000024',4),
  -- Crimson Wyrmling
  ('c0001-0000-0000-0000-000000000006','m0001-0000-0000-0000-000000000049',1),
  ('c0001-0000-0000-0000-000000000006','m0001-0000-0000-0000-000000000050',2),
  ('c0001-0000-0000-0000-000000000006','m0001-0000-0000-0000-000000000051',3),
  ('c0001-0000-0000-0000-000000000006','m0001-0000-0000-0000-000000000001',4),
  -- Brackish Wyrmling
  ('c0001-0000-0000-0000-000000000007','m0001-0000-0000-0000-000000000049',1),
  ('c0001-0000-0000-0000-000000000007','m0001-0000-0000-0000-000000000050',2),
  ('c0001-0000-0000-0000-000000000007','m0001-0000-0000-0000-000000000051',3),
  ('c0001-0000-0000-0000-000000000007','m0001-0000-0000-0000-000000000037',4),
  -- Storm Wyrmling
  ('c0001-0000-0000-0000-000000000008','m0001-0000-0000-0000-000000000049',1),
  ('c0001-0000-0000-0000-000000000008','m0001-0000-0000-0000-000000000050',2),
  ('c0001-0000-0000-0000-000000000008','m0001-0000-0000-0000-000000000051',3),
  ('c0001-0000-0000-0000-000000000008','m0001-0000-0000-0000-000000000009',4),
  -- Verdant Wyrmling
  ('c0001-0000-0000-0000-000000000009','m0001-0000-0000-0000-000000000049',1),
  ('c0001-0000-0000-0000-000000000009','m0001-0000-0000-0000-000000000050',2),
  ('c0001-0000-0000-0000-000000000009','m0001-0000-0000-0000-000000000051',3),
  ('c0001-0000-0000-0000-000000000009','m0001-0000-0000-0000-000000000048',4),
  -- Shadowborn Wyrmling
  ('c0001-0000-0000-0000-000000000010','m0001-0000-0000-0000-000000000049',1),
  ('c0001-0000-0000-0000-000000000010','m0001-0000-0000-0000-000000000050',2),
  ('c0001-0000-0000-0000-000000000010','m0001-0000-0000-0000-000000000051',3),
  ('c0001-0000-0000-0000-000000000010','m0001-0000-0000-0000-000000000046',4),
  -- Half-dragon
  ('c0001-0000-0000-0000-000000000011','m0001-0000-0000-0000-000000000052',1),
  ('c0001-0000-0000-0000-000000000011','m0001-0000-0000-0000-000000000053',2),
  ('c0001-0000-0000-0000-000000000011','m0001-0000-0000-0000-000000000054',3),
  ('c0001-0000-0000-0000-000000000011','m0001-0000-0000-0000-000000000003',4),
  -- Dragonclaw
  ('c0001-0000-0000-0000-000000000012','m0001-0000-0000-0000-000000000025',1),
  ('c0001-0000-0000-0000-000000000012','m0001-0000-0000-0000-000000000026',2),
  ('c0001-0000-0000-0000-000000000012','m0001-0000-0000-0000-000000000027',3),
  ('c0001-0000-0000-0000-000000000012','m0001-0000-0000-0000-000000000004',4),
  -- Dragon Fang
  ('c0001-0000-0000-0000-000000000013','m0001-0000-0000-0000-000000000028',1),
  ('c0001-0000-0000-0000-000000000013','m0001-0000-0000-0000-000000000029',2),
  ('c0001-0000-0000-0000-000000000013','m0001-0000-0000-0000-000000000030',3),
  ('c0001-0000-0000-0000-000000000013','m0001-0000-0000-0000-000000000027',4),
  -- Wyrmspeaker
  ('c0001-0000-0000-0000-000000000014','m0001-0000-0000-0000-000000000031',1),
  ('c0001-0000-0000-0000-000000000014','m0001-0000-0000-0000-000000000032',2),
  ('c0001-0000-0000-0000-000000000014','m0001-0000-0000-0000-000000000033',3),
  ('c0001-0000-0000-0000-000000000014','m0001-0000-0000-0000-000000000026',4),
  -- Ash Wraith
  ('c0001-0000-0000-0000-000000000015','m0001-0000-0000-0000-000000000034',1),
  ('c0001-0000-0000-0000-000000000015','m0001-0000-0000-0000-000000000035',2),
  ('c0001-0000-0000-0000-000000000015','m0001-0000-0000-0000-000000000036',3),
  ('c0001-0000-0000-0000-000000000015','m0001-0000-0000-0000-000000000015',4),
  -- Drowned Reliquary
  ('c0001-0000-0000-0000-000000000016','m0001-0000-0000-0000-000000000037',1),
  ('c0001-0000-0000-0000-000000000016','m0001-0000-0000-0000-000000000038',2),
  ('c0001-0000-0000-0000-000000000016','m0001-0000-0000-0000-000000000039',3),
  ('c0001-0000-0000-0000-000000000016','m0001-0000-0000-0000-000000000005',4),
  -- Hollow Saint
  ('c0001-0000-0000-0000-000000000017','m0001-0000-0000-0000-000000000040',1),
  ('c0001-0000-0000-0000-000000000017','m0001-0000-0000-0000-000000000041',2),
  ('c0001-0000-0000-0000-000000000017','m0001-0000-0000-0000-000000000042',3),
  ('c0001-0000-0000-0000-000000000017','m0001-0000-0000-0000-000000000015',4),
  -- Stormcrest Sentinel
  ('c0001-0000-0000-0000-000000000018','m0001-0000-0000-0000-000000000043',1),
  ('c0001-0000-0000-0000-000000000018','m0001-0000-0000-0000-000000000044',2),
  ('c0001-0000-0000-0000-000000000018','m0001-0000-0000-0000-000000000045',3),
  ('c0001-0000-0000-0000-000000000018','m0001-0000-0000-0000-000000000011',4),
  -- Shadow-touched Monk
  ('c0001-0000-0000-0000-000000000019','m0001-0000-0000-0000-000000000046',1),
  ('c0001-0000-0000-0000-000000000019','m0001-0000-0000-0000-000000000047',2),
  ('c0001-0000-0000-0000-000000000019','m0001-0000-0000-0000-000000000048',3),
  ('c0001-0000-0000-0000-000000000019','m0001-0000-0000-0000-000000000018',4),
  -- Cinderwyrm
  ('c0001-0000-0000-0000-000000000020','m0001-0000-0000-0000-000000000001',1),
  ('c0001-0000-0000-0000-000000000020','m0001-0000-0000-0000-000000000004',2),
  ('c0001-0000-0000-0000-000000000020','m0001-0000-0000-0000-000000000002',3),
  ('c0001-0000-0000-0000-000000000020','m0001-0000-0000-0000-000000000003',4)
on conflict do nothing;
```

- [ ] **Step 2: Apply seed**

```bash
npx supabase db reset
```

Expected: migration runs, then seed inserts 6 gates, 64 effectiveness rows, 54 moves, 20 creatures.

- [ ] **Step 3: Verify in Supabase dashboard**

Table Editor → `creatures`: 20 rows. Filter `approved = true`: 19 rows (Infernadax is false until `five-seals-broken` gate opens).

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: seed canon creatures, moves, campaign gates, type effectiveness"
```

---

### Task 4: Supabase client + auth middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `tests/lib/supabase-env.test.ts`

- [ ] **Step 1: Create browser client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from Server Component — middleware handles setting
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create auth middleware**

Create `middleware.ts` in the project root:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedPaths = ['/forge', '/vault', '/battle', '/challenges', '/admin']
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 4: Write env smoke test**

Create `tests/lib/supabase-env.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('Supabase environment variables', () => {
  it('has NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\//)
  })

  it('has NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 5: Run test**

```bash
npm run test:run tests/lib/supabase-env.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/ middleware.ts tests/
git commit -m "feat: Supabase clients and auth middleware"
```

---

### Task 5: Auth pages

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create login page**

Create `app/login/page.tsx`:

```tsx
'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${redirectTo}`,
      },
    })
    if (error) setError('The vault will not open. Try again.')
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center max-w-sm">
        <p className="text-stone-300 text-lg mb-2">The message has been sent.</p>
        <p className="text-stone-500 text-sm">Check your correspondence. Return when the link arrives.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-stone-100 text-2xl font-semibold mb-2">Enter the Threshold</h1>
      <p className="text-stone-500 text-sm mb-8">A link will be sent to your correspondence address.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your correspondence address"
          required
          className="w-full bg-stone-900 border border-stone-700 text-stone-100 rounded px-4 py-3 text-sm placeholder:text-stone-600 focus:outline-none focus:border-stone-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-stone-100 text-stone-950 rounded px-4 py-3 text-sm font-semibold hover:bg-stone-200 transition-colors"
        >
          Open the Gate
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 2: Create auth callback route**

Create `app/auth/callback/route.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Create user profile on first login (upsert is idempotent)
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email!,
        username: data.user.email!.split('@')[0],
      }, { onConflict: 'id', ignoreDuplicates: true })

      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/login/ app/auth/
git commit -m "feat: magic link login page and auth callback"
```

---

### Task 6: Title screen

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update root layout**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Crimson_Pro } from 'next/font/google'
import './globals.css'

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-crimson',
})

export const metadata: Metadata = {
  title: 'Five Seals Bestiary',
  description: 'The chronicler records what walks in the dark.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={crimsonPro.variable}>
      <body className="bg-stone-950 text-stone-100 antialiased font-serif">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Write the title screen**

Replace `app/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function TitleScreen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-red-950/5 to-stone-950 pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg">
        <p className="text-stone-500 text-sm italic mb-12 leading-relaxed">
          "You come to the mountain bearing names and small bright hopes.<br />
          Infernadax has watched three hundred years of such arrivals.<br />
          He is patient. He is watching."
        </p>

        <h1 className="text-stone-100 text-5xl font-semibold tracking-wide mb-2">
          Five Seals
        </h1>
        <p className="text-stone-400 text-xl italic mb-8">Bestiary</p>

        <div className="border-t border-b border-stone-800 py-6 mb-10">
          <p className="text-stone-500 text-sm italic leading-loose">
            Seven shall stand before the Eternal Flame.<br />
            Five shall fall.<br />
            Two shall remain.<br />
            The scales will be balanced in blood and sacrifice.
          </p>
        </div>

        {user ? (
          <div className="space-y-3">
            <Link
              href="/bestiary"
              className="block w-full bg-stone-100 text-stone-950 rounded px-8 py-3 text-sm font-semibold hover:bg-stone-200 transition-colors"
            >
              Enter the Bestiary
            </Link>
            <Link
              href="/vault"
              className="block w-full border border-stone-700 text-stone-400 rounded px-8 py-3 text-sm hover:border-stone-500 hover:text-stone-300 transition-colors"
            >
              Return to the Vault
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="block w-full bg-stone-100 text-stone-950 rounded px-8 py-3 text-sm font-semibold hover:bg-stone-200 transition-colors"
          >
            Enter the Threshold
          </Link>
        )}

        <p className="text-stone-700 text-xs mt-10">
          One seal has already broken. The flame grows stronger.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify locally**

```bash
npm run dev
```

Open http://localhost:3000 — title screen with Infernadax's quote, Prophecy stanza, and "Enter the Threshold" button.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: title screen with Infernadax voice and Prophecy"
```

---

### Task 7: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Import project in Vercel**

Go to https://vercel.com/new → Import your GitHub repo → Accept Next.js defaults → Deploy.

- [ ] **Step 3: Add environment variables**

In Vercel project → Settings → Environment Variables, add all five vars from `.env.local.example` with your real values.

- [ ] **Step 4: Add Vercel URL to Supabase auth**

In Supabase → Authentication → URL Configuration:
- Site URL: `https://your-project.vercel.app`
- Redirect URLs: `https://your-project.vercel.app/auth/callback`

- [ ] **Step 5: Redeploy**

```bash
git commit --allow-empty -m "chore: trigger Vercel redeploy after env vars"
git push origin main
```

- [ ] **Step 6: Verify**

Open your Vercel URL. Complete a magic-link login. Check Supabase → Table Editor → `users` — your row should appear.

- [ ] **Step 7: Grant admin**

In Supabase → Table Editor → `users`, find your row, set `is_admin = true`.

---

## Self-Review

| Spec requirement | Task |
|---|---|
| Next.js + Supabase + Vercel | Tasks 1, 2, 7 |
| All DB tables + RLS | Task 2 |
| Type effectiveness table + seed | Tasks 2, 3 |
| 20 canon creatures seeded | Task 3 |
| 54 moves seeded | Task 3 |
| 6 campaign gates seeded | Task 3 |
| Magic link auth | Tasks 4, 5 |
| User profile created on first login | Task 5 |
| Title screen in game voice | Task 6 |
| Admin flag | Task 7 |

**Not in this plan:** Bestiary, Forge, Battle, Admin panel, PvP, Profiles — covered by Plans 2–6.

**Placeholder scan:** None. All code blocks are complete.

**Type consistency:** `createClient()` exported from both `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server). Used consistently across Tasks 5 and 6.
