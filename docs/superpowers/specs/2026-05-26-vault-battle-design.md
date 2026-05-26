# Plan 4: Vault & Battle — Design

## Goal

Add a personal Vault where authenticated players can view their own creatures, and a turn-based vs-AI battle system where players challenge campaign trainer bosses using those creatures.

## Scope

- **In:** Vault page, trainer selection, team selection, vs-AI battle (1v1 with reserves), victory/defeat screens
- **Out:** PvP battle (Plan 6), battle history browsing, persistent HP between battles, creature collection of canon creatures

---

## Architecture

Three new pages, one battle engine library, two API routes, one migration.

- **`/vault`** — server component. Lists the player's own creatures with filter chips (All / Approved / Pending) and status badges. "Challenge a Trainer" CTA at the bottom.
- **`/battle/new`** — server component listing available trainers. `<TeamSelector>` client component handles creature selection (1–6 own creatures) before creating the battle.
- **`/battle/[id]`** — server component loads battle + initial state; hands off to `<BattleArena>` client component which manages all interactivity without page navigation.

**Battle engine (`lib/battle/engine.ts`)** — pure functions, fully unit-testable. No side effects, no DB calls.

**Turn resolution is server-authoritative and single-call.** The player submits one move → server resolves both the player's move and the AI's move → returns the full result. No polling, no WebSocket, no pending state between the two moves.

**HP resets to full at battle start.** No HP persists between battles.

---

## Data Model

### Migration: `supabase/migrations/20260526000001_battle_state.sql`

Add `battle_state JSONB` column to the existing `battles` table. Also add write RLS policies for battles, battle_teams, and battle_turns (read policies already exist from the initial migration).

```sql
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

-- Players can insert turns for battles they own (including AI turns inserted server-side)
-- acting_user_id = auth.uid() would block AI turn rows, so we check battle ownership instead
create policy "players insert own battle_turns" on battle_turns
  for insert to authenticated
  with check (
    exists (
      select 1 from battles
      where battles.id = battle_id
        and battles.challenger_id = auth.uid()
    )
  );
```

### `battle_state` JSONB structure

```typescript
interface BattleState {
  player_team: {
    creature_id: string
    current_hp: number
    max_hp: number
    slot: number            // 1-indexed, matches battle_teams.slot
  }[]
  player_active_slot: number  // index into player_team (0-indexed)
  player_effects: {
    effect: 'atk_down' | 'def_up' | 'spd_down' | 'drain'
    turns_remaining: number
  }[]
  trainer_team: {
    creature_id: string
    current_hp: number
    max_hp: number
    slot: number
  }[]
  trainer_active_slot: number
  trainer_effects: {
    effect: 'atk_down' | 'def_up' | 'spd_down' | 'drain'
    turns_remaining: number
  }[]
  turn_number: number
}
```

---

## Battle Engine (`lib/battle/engine.ts`)

Pure functions only. All inputs passed in; no imports from Supabase or Next.js.

### Damage formula

```typescript
function calculateDamage(atk: number, power: number, def: number, effectiveness: number): number {
  return Math.max(1, Math.round((atk * power) / (def * 2) * effectiveness))
}
```

Effectiveness values come from the `type_effectiveness` table (0.5 / 1.0 / 2.0). If no row exists for a type matchup, default to 1.0.

### Status effects

Applied after damage. Effects modify stats for subsequent turns:

| Effect | Application |
|--------|------------|
| `atk_down` | Target's effective ATK × 0.75 for 3 turns |
| `def_up` | User's effective DEF × 1.25 for 3 turns |
| `spd_down` | Target's effective SPD × 0.75 for 3 turns |
| `drain` | Deals damage; user heals 50% of damage dealt |

Effects stack additively if the same effect is applied again (reset duration to 3). Tick down one turn after each full round (both moves resolved).

### Turn order

Faster creature (by effective `spd`, after status effects) goes first. Tie → random 50/50.

### AI move selection (`selectAiMove`)

Takes `trainer.ai_behavior`, the active AI creature (with current stats + effects), the active player creature, available moves, and the type effectiveness table.

| Behavior | Logic |
|----------|-------|
| `aggressive` | Always pick highest-power attack move. If no attack moves, use any status move. |
| `defensive` | If own current_hp < 40% of max_hp and a status move is available, use it. Otherwise pick the attack move with best type effectiveness (ties broken by power). |
| `balanced` | Pick the move with the best type effectiveness modifier. Ties broken by power. |

### `resolveTurn`

```typescript
function resolveTurn(
  state: BattleState,
  playerMoveId: string,
  aiMoveId: string,
  creatures: Map<string, CreatureWithMoves>,
  typeEffectiveness: Map<string, number>  // key: `${attackingType}:${defendingType}`
): { newState: BattleState; playerTurn: TurnRecord; aiTurn: TurnRecord; battleOver: boolean; winner: 'player' | 'trainer' | null }
```

Steps:
1. Determine turn order by effective SPD
2. Resolve first mover's move: calculate damage, apply to defender HP, apply status effect
3. Check for faint — if defender HP ≤ 0, advance active slot; if no slots remain, battle is over
4. If battle not over, resolve second mover's move
5. Check for faint again
6. Tick down all active status effects (both sides)
7. Increment turn_number
8. Return updated state + two TurnRecords + battleOver flag

---

## Chronicle Templates (`lib/battle/templates.ts`)

One sentence per move, returned as `chronicle_text` on `battle_turns` rows.

```typescript
function attackChronicle(attackerName: string, moveName: string, targetName: string, damage: number, effectiveness: number): string
// effectiveness > 1.0 → "finds a weakness"
// effectiveness < 1.0 → "glances off"
// effectiveness === 1.0 → "strikes with"

function statusChronicle(userName: string, moveName: string, targetName: string, effect: StatusEffect): string
// atk_down  → "[Move] strips the edge from [Target]'s strikes."
// def_up    → "[Move] hardens [User]'s defenses."
// spd_down  → "[Move] slows [Target]'s movement."
// drain     → "[Move] drains [Target]'s vitality. [N] absorbed."

function faintChronicle(name: string): string
// "[Name] falls."

function battleEndChronicle(winner: 'player' | 'trainer', trainerName: string): string
// player win → "[TrainerName] is overcome. The seal holds — for now."
// player loss → "Your creatures are spent. The darkness advances."
```

---

## API Routes

### `POST /api/battle/create`

**Input:**
```typescript
{ trainer_id: string; creature_slots: string[] }  // creature_slots: 1–6 creature IDs
```

**Validation:**
- Auth required (401)
- `trainer_id` must exist in `trainers` table (400)
- `creature_slots`: 1–6 items, all must be player's own creatures (400)
- No duplicate creature IDs (400)

**Action:**
1. Load trainer's creatures (from `trainer_creatures` ordered by slot)
2. Load player's creatures with moves
3. Build initial `battle_state`: all creatures at full HP, active slot 0, no effects, turn 0
4. Insert `battles` row (`type: 'vs-ai'`, `challenger_id`, `trainer_id`, `status: 'active'`, `battle_state`)
5. Insert `battle_teams` rows for player's team
6. Return `{ id: battle.id }`

### `POST /api/battle/[id]/turn`

**Input:**
```typescript
{ move_id: string }
```

**Validation:**
- Auth required (401)
- Battle exists and belongs to player (404)
- Battle status is `'active'` (400)
- `move_id` must be one of the active player creature's 4 moves (400)

**Action:**
1. Load `battle_state` and all creature/move data needed for resolution
2. Load type effectiveness table into Map
3. `selectAiMove()` to pick AI's move
4. `resolveTurn()` to get new state and turn records
5. Insert two `battle_turns` rows
6. Update `battles` with new `battle_state`; if `battleOver`, set `status: 'complete'` and `winner_id`
7. Return `{ state: newState, playerTurn, aiTurn, battleOver, winner }`

---

## Pages & Components

### `/vault` — `app/vault/page.tsx`

Server component. Fetches `getVaultCreatures()` (creatures where `creator_id = auth.uid()`). Renders `<VaultCreatureCard>` in a responsive grid. Filter chips (All / Approved / Pending) handled via `searchParams`. "Challenge a Trainer" button links to `/battle/new`.

### `/battle/new` — `app/battle/new/page.tsx`

Server component. Fetches trainers list and player's own creatures. Renders trainer cards. `<TeamSelector>` client component: player clicks a trainer, selects 1–6 creatures from their vault, clicks "Enter the battle" → `POST /api/battle/create` → redirect to `/battle/[id]`.

### `/battle/[id]` — `app/battle/[id]/page.tsx`

Server component. Fetches battle + full creature data. Renders `<BattleArena moves={moves} initialState={...} />`.

### `<BattleArena>` — `components/battle/BattleArena.tsx`

Client component. Manages: `state`, `chronicle`, `isResolving`, `result`. Renders:
- `<BattleCreatureCard>` — wide banner (B2): both creature artworks in a panoramic strip facing each other, with HP bars and names below side-by-side. Artwork falls back to a dark placeholder if `artwork_url` is null.
- `<MoveGrid>` — 2×2 grid of move buttons (disabled while `isResolving`). Each button shows move name, type colour, and power/effect label.
- `<ChronicleLog>` — scrollable list of chronicle sentences, newest appended at bottom.
- Victory/defeat overlay: inline, no navigation. Shows result text in game voice + links to `/vault` and `/battle/new`.

---

## Vault Page Layout

Flat grid with filter chips (All / Approved / Pending) at the top. Approved creatures show a green "Approved" badge; pending show a grey "Pending" badge. "Challenge a Trainer" CTA at the bottom. Uses existing `CreatureCard` styling extended with the badge and optional checkbox for team selection.

---

## Battle UI Layout (B2 — Wide Banner)

```
┌──────────────────────────────────────────────────┐
│  [artwork left, faded]  vs  [artwork right, faded] │  ← panoramic strip, ~90px tall
└──────────────────────────────────────────────────┘
  Ashen Herald          ●●○        ○○●  Tide Haunt
  Undead                                  Elemental
  ████████░░ 29/45 HP        38/55 HP ████████████
                                                    
  ┌─────────────┐   ┌─────────────────────────────┐
  │ chronicle   │   │ (scrollable, italic, small)  │
  └─────────────┴───┴─────────────────────────────┘
  ┌──────────┐ ┌──────────┐
  │ Bone Hymn│ │Twilight V│
  │Undead·45p│ │Arcane·DEF│
  └──────────┘ └──────────┘
  ┌──────────┐ ┌──────────┐
  │Hollow Gaz│ │Crimson Bt│
  │Undead·ATK│ │Fiendish·5│
  └──────────┘ └──────────┘
```

---

## Testing

**`tests/lib/battle/engine.test.ts`** — pure unit tests, no mocks needed:
- Damage formula: normal, effective (2×), weak (0.5×), minimum 1
- `selectAiMove`: aggressive picks highest power; defensive switches to status at low HP; balanced picks best effectiveness
- `resolveTurn`: faster creature goes first; faint advances active slot; battle ends when team exhausted; status effects tick down; drain heals attacker

**`tests/api/battle-create.test.ts`** — mocked Supabase:
- 401 unauthenticated
- 400 trainer not found
- 400 empty team / too many creatures
- 400 creatures not owned by player
- 200 returns battle id, correct initial state shape

**`tests/api/battle-turn.test.ts`** — mocked Supabase + engine:
- 401 unauthenticated
- 404 battle not found / wrong player
- 400 battle already complete
- 400 invalid move for active creature
- 200 returns updated state + two turn records
- 200 with `battleOver: true` when team exhausted

---

## Queries to add (`lib/supabase/queries.ts`)

- `getVaultCreatures(): Promise<Creature[]>` — creatures where `creator_id = auth.uid()`, ordered by `created_at desc`
- `getTrainers(): Promise<Trainer[]>` — all trainers, ordered by `gate_key`
- `getBattle(id: string): Promise<BattleWithState | null>` — battle with `battle_state`, `battle_teams`, trainer info
