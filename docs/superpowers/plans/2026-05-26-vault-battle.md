# Vault & Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal Vault where authenticated players view their own creatures, and a turn-based vs-AI battle system where players challenge campaign trainer bosses using those creatures.

**Architecture:** Three new pages (`/vault`, `/battle/new`, `/battle/[id]`), a pure-function battle engine in `lib/battle/`, and two API routes (`POST /api/battle/create`, `POST /api/battle/[id]/turn`). The server resolves both the player's move and the AI's move in one call and returns the full result — no polling, no websocket.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), React 19, Tailwind CSS 4, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260526000001_battle_state.sql` | Add `battle_state` JSONB column + write RLS policies |
| Create | `lib/battle/types.ts` | `BattleState`, `TurnRecord`, `CreatureWithMoves` (battle-scoped), `Trainer` interfaces |
| Create | `lib/battle/engine.ts` | Pure functions: `calculateDamage`, `selectAiMove`, `resolveTurn` |
| Create | `lib/battle/templates.ts` | `attackChronicle`, `statusChronicle`, `faintChronicle`, `battleEndChronicle` |
| Create | `tests/lib/battle/engine.test.ts` | Unit tests for all engine functions |
| Modify | `lib/supabase/queries.ts` | Add `getVaultCreatures`, `getTrainers`, `getBattle` |
| Create | `app/api/battle/create/route.ts` | `POST /api/battle/create` |
| Create | `app/api/battle/[id]/turn/route.ts` | `POST /api/battle/[id]/turn` |
| Create | `tests/api/battle-create.test.ts` | API tests for create |
| Create | `tests/api/battle-turn.test.ts` | API tests for turn |
| Create | `app/vault/page.tsx` | Server component — player's creature grid |
| Create | `app/battle/new/page.tsx` | Server component — trainer selection + team selector |
| Create | `app/battle/[id]/page.tsx` | Server component — loads battle, renders `<BattleArena>` |
| Create | `components/battle/BattleArena.tsx` | Client component — full battle interactivity |
| Create | `components/battle/BattleCreatureCard.tsx` | Wide banner with both creature artworks + HP bars |
| Create | `components/battle/MoveGrid.tsx` | 2×2 move button grid |
| Create | `components/battle/ChronicleLog.tsx` | Scrollable chronicle list |
| Create | `components/battle/TeamSelector.tsx` | Client component — creature selection before battle |

---

## Task 1: DB Migration — battle_state column + write RLS

**Files:**
- Create: `supabase/migrations/20260526000001_battle_state.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260526000001_battle_state.sql

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
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: Migration applies cleanly. If running locally: `npx supabase migration up`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260526000001_battle_state.sql
git commit -m "feat: add battle_state JSONB column and write RLS policies"
```

---

## Task 2: Battle types

**Files:**
- Create: `lib/battle/types.ts`

> **Context:** These types are used by the engine, templates, API routes, and components. Define them once here. `CreatureWithMoves` here is battle-scoped (includes resolved move objects with stats); it is separate from the same-named type in `lib/types.ts`.

- [ ] **Step 1: Write `lib/battle/types.ts`**

```typescript
import type { Move } from '@/lib/types'

export interface BattleCreature {
  creature_id: string
  current_hp: number
  max_hp: number
  slot: number  // 1-indexed, matches battle_teams.slot
}

export interface ActiveEffect {
  effect: 'atk_down' | 'def_up' | 'spd_down' | 'drain'
  turns_remaining: number
}

export interface BattleState {
  player_team: BattleCreature[]
  player_active_slot: number  // 0-indexed into player_team
  player_effects: ActiveEffect[]
  trainer_team: BattleCreature[]
  trainer_active_slot: number  // 0-indexed into trainer_team
  trainer_effects: ActiveEffect[]
  turn_number: number
}

export interface TurnRecord {
  actor: 'player' | 'trainer'
  creature_id: string
  move_id: string
  damage: number | null
  effectiveness: number  // 0.5 | 1.0 | 2.0
  chronicle_text: string
  fainted: boolean       // did the target faint this turn?
}

// Full creature data needed during battle resolution
export interface BattleCreatureData {
  id: string
  name: string
  types: string[]
  hp: number
  atk: number
  def: number
  spd: number
  moves: Move[]
}

export interface Trainer {
  id: string
  name: string
  description: string
  intro_text: string
  win_text: string
  loss_text: string
  ai_behavior: 'aggressive' | 'defensive' | 'balanced'
  gate_key: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/battle/types.ts
git commit -m "feat: add battle types"
```

---

## Task 3: Battle engine — pure functions

**Files:**
- Create: `lib/battle/engine.ts`
- Create: `tests/lib/battle/engine.test.ts`

> **Context:** No imports from Supabase or Next.js. All inputs are passed in. The engine never has side effects.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/battle/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  calculateDamage,
  applyEffectToStat,
  selectAiMove,
  resolveTurn,
} from '@/lib/battle/engine'
import type { BattleState, BattleCreatureData, ActiveEffect } from '@/lib/battle/types'
import type { Move } from '@/lib/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const attackMove: Move = {
  id: 'mv-attack',
  name: 'Bone Hymn',
  type: 'Undead',
  power: 45,
  move_type: 'attack',
  status_effect: null,
  description: 'test',
}

const strongAttackMove: Move = {
  id: 'mv-strong',
  name: 'Strong Strike',
  type: 'Elemental',
  power: 60,
  move_type: 'attack',
  status_effect: null,
  description: 'test',
}

const statusMove: Move = {
  id: 'mv-status',
  name: 'Hollow Gaze',
  type: 'Undead',
  power: null,
  move_type: 'status',
  status_effect: 'atk_down',
  description: 'test',
}

const drainMove: Move = {
  id: 'mv-drain',
  name: 'Silent Prayer',
  type: 'Celestial',
  power: 40,
  move_type: 'status',
  status_effect: 'drain',
  description: 'test',
}

function makeCreature(overrides: Partial<BattleCreatureData> = {}): BattleCreatureData {
  return {
    id: 'creature-1',
    name: 'Ashen Herald',
    types: ['Undead'],
    hp: 45,
    atk: 40,
    def: 50,
    spd: 35,
    moves: [attackMove, statusMove],
    ...overrides,
  }
}

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    player_team: [{ creature_id: 'p1', current_hp: 45, max_hp: 45, slot: 1 }],
    player_active_slot: 0,
    player_effects: [],
    trainer_team: [{ creature_id: 't1', current_hp: 55, max_hp: 55, slot: 1 }],
    trainer_active_slot: 0,
    trainer_effects: [],
    turn_number: 1,
    ...overrides,
  }
}

const typeMap = new Map<string, number>([
  ['Undead:Elemental', 0.5],
  ['Undead:Undead', 0.5],
  ['Elemental:Undead', 2.0],
])

const playerCreature = makeCreature({ id: 'p1', types: ['Undead'], spd: 35 })
const trainerCreature = makeCreature({ id: 't1', name: 'Tide Haunt', types: ['Elemental'], spd: 30 })

const creatures = new Map<string, BattleCreatureData>([
  ['p1', playerCreature],
  ['t1', trainerCreature],
])

// ── calculateDamage ───────────────────────────────────────────────────────────

describe('calculateDamage', () => {
  it('calculates normal damage', () => {
    // (40 * 45) / (50 * 2) * 1.0 = 1800 / 100 = 18
    expect(calculateDamage(40, 45, 50, 1.0)).toBe(18)
  })

  it('doubles damage for effective hit', () => {
    // (40 * 45) / (50 * 2) * 2.0 = 36
    expect(calculateDamage(40, 45, 50, 2.0)).toBe(36)
  })

  it('halves damage for weak hit', () => {
    // (40 * 45) / (50 * 2) * 0.5 = 9
    expect(calculateDamage(40, 45, 50, 0.5)).toBe(9)
  })

  it('returns minimum 1 when formula rounds to 0', () => {
    expect(calculateDamage(1, 1, 200, 0.5)).toBe(1)
  })
})

// ── applyEffectToStat ─────────────────────────────────────────────────────────

describe('applyEffectToStat', () => {
  it('reduces ATK by 25% for atk_down', () => {
    const effects: ActiveEffect[] = [{ effect: 'atk_down', turns_remaining: 2 }]
    expect(applyEffectToStat(40, 'atk', effects)).toBe(30)  // 40 * 0.75 = 30
  })

  it('increases DEF by 25% for def_up', () => {
    const effects: ActiveEffect[] = [{ effect: 'def_up', turns_remaining: 2 }]
    expect(applyEffectToStat(50, 'def', effects)).toBe(63)  // 50 * 1.25 = 62.5 → 63
  })

  it('reduces SPD by 25% for spd_down', () => {
    const effects: ActiveEffect[] = [{ effect: 'spd_down', turns_remaining: 2 }]
    expect(applyEffectToStat(35, 'spd', effects)).toBe(26)  // 35 * 0.75 = 26.25 → 26
  })

  it('returns base stat when no relevant effect', () => {
    const effects: ActiveEffect[] = [{ effect: 'def_up', turns_remaining: 2 }]
    expect(applyEffectToStat(40, 'atk', effects)).toBe(40)
  })

  it('returns base stat when effects array is empty', () => {
    expect(applyEffectToStat(40, 'atk', [])).toBe(40)
  })
})

// ── selectAiMove ──────────────────────────────────────────────────────────────

describe('selectAiMove', () => {
  const movesWithBoth = [attackMove, strongAttackMove, statusMove]

  it('aggressive: picks highest-power attack move', () => {
    const result = selectAiMove('aggressive', trainerCreature, playerCreature, movesWithBoth, typeMap)
    expect(result.id).toBe('mv-strong')  // power 60 > 45
  })

  it('aggressive: falls back to status move if no attack moves', () => {
    const result = selectAiMove('aggressive', trainerCreature, playerCreature, [statusMove], typeMap)
    expect(result.id).toBe('mv-status')
  })

  it('defensive: uses status move when HP below 40%', () => {
    const lowHpTrainer = makeCreature({
      id: 't1',
      types: ['Elemental'],
      moves: [attackMove, statusMove],
    })
    // Simulating low HP by passing a creature state — engine uses current_hp from BattleState
    // defensive behavior is triggered externally via current_hp check
    // We test the function with explicit low_hp parameter
    const result = selectAiMove(
      'defensive',
      { ...lowHpTrainer },
      playerCreature,
      [attackMove, statusMove],
      typeMap,
      { current_hp: 10, max_hp: 55 },  // 10/55 = 18% < 40%
    )
    expect(result.id).toBe('mv-status')
  })

  it('defensive: uses best-effectiveness attack when HP is healthy', () => {
    // Elemental vs Undead = 2.0; Undead vs Elemental = 0.5
    // strongAttackMove is Elemental (2.0 vs Undead player) → should win
    const result = selectAiMove(
      'defensive',
      trainerCreature,  // Elemental trainer
      playerCreature,   // Undead player
      [attackMove, strongAttackMove],
      typeMap,
      { current_hp: 50, max_hp: 55 },  // healthy
    )
    expect(result.id).toBe('mv-strong')  // Elemental is 2.0× vs Undead
  })

  it('balanced: picks move with best type effectiveness', () => {
    // Elemental trainer vs Undead player → strongAttackMove (Elemental) = 2.0
    const result = selectAiMove('balanced', trainerCreature, playerCreature, [attackMove, strongAttackMove], typeMap)
    expect(result.id).toBe('mv-strong')
  })

  it('balanced: breaks ties by power', () => {
    // Both Elemental type — tie on effectiveness, resolve by power
    const elemental60: Move = { ...attackMove, id: 'el-60', type: 'Elemental', power: 60 }
    const elemental45: Move = { ...attackMove, id: 'el-45', type: 'Elemental', power: 45 }
    const result = selectAiMove('balanced', trainerCreature, playerCreature, [elemental45, elemental60], typeMap)
    expect(result.id).toBe('el-60')
  })
})

// ── resolveTurn ───────────────────────────────────────────────────────────────

describe('resolveTurn', () => {
  it('faster creature (player) goes first', () => {
    // playerCreature spd=35, trainerCreature spd=30 → player is faster
    const state = makeState()
    const { playerTurn, aiTurn } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    // Player acts first → player chronicle comes first
    expect(playerTurn.actor).toBe('player')
    expect(aiTurn.actor).toBe('trainer')
  })

  it('slower creature takes reduced HP before it can attack', () => {
    const state = makeState()
    const { newState } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    // Trainer was hit first; both took hits but trainer hit second
    expect(newState.player_team[0].current_hp).toBeLessThan(45)
    expect(newState.trainer_team[0].current_hp).toBeLessThan(55)
  })

  it('faint advances active slot when defender HP reaches 0', () => {
    // Trainer has 1 HP — will faint after player hits
    const state = makeState({
      trainer_team: [
        { creature_id: 't1', current_hp: 1, max_hp: 55, slot: 1 },
        { creature_id: 't2', current_hp: 55, max_hp: 55, slot: 2 },
      ],
      trainer_active_slot: 0,
    })
    const t2Creature = makeCreature({ id: 't2', name: 'Backup', types: ['Elemental'], spd: 30 })
    const extendedCreatures = new Map(creatures)
    extendedCreatures.set('t2', t2Creature)

    const { newState, playerTurn } = resolveTurn(state, attackMove.id, attackMove.id, extendedCreatures, typeMap)
    expect(playerTurn.fainted).toBe(true)
    expect(newState.trainer_active_slot).toBe(1)
    expect(newState.trainer_team[0].current_hp).toBe(0)
  })

  it('sets battleOver=true when last trainer creature faints', () => {
    const state = makeState({
      trainer_team: [{ creature_id: 't1', current_hp: 1, max_hp: 55, slot: 1 }],
      trainer_active_slot: 0,
    })
    const { battleOver, winner } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    expect(battleOver).toBe(true)
    expect(winner).toBe('player')
  })

  it('ticks down status effects after full round', () => {
    const state = makeState({
      player_effects: [{ effect: 'atk_down', turns_remaining: 2 }],
    })
    const { newState } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    expect(newState.player_effects[0].turns_remaining).toBe(1)
  })

  it('removes status effect when turns_remaining reaches 0', () => {
    const state = makeState({
      player_effects: [{ effect: 'atk_down', turns_remaining: 1 }],
    })
    const { newState } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    expect(newState.player_effects).toHaveLength(0)
  })

  it('drain move heals attacker by 50% of damage dealt', () => {
    // Player at 30/45 HP uses drain (power=40) vs trainer Elemental (2.0× vs Undead drain type=Celestial → 1.0)
    // drainMove type=Celestial; vs Elemental = check typeMap (not present → default 1.0)
    const state = makeState({
      player_team: [{ creature_id: 'p1', current_hp: 30, max_hp: 45, slot: 1 }],
    })
    const drainCreature = makeCreature({ id: 'p1', moves: [drainMove] })
    const testCreatures = new Map<string, BattleCreatureData>([
      ['p1', drainCreature],
      ['t1', trainerCreature],
    ])
    const { newState } = resolveTurn(state, drainMove.id, attackMove.id, testCreatures, typeMap)
    // Player healed by 50% of damage; should be higher than 30
    expect(newState.player_team[0].current_hp).toBeGreaterThan(30)
    // Should not exceed max_hp
    expect(newState.player_team[0].current_hp).toBeLessThanOrEqual(45)
  })

  it('increments turn_number', () => {
    const state = makeState({ turn_number: 3 })
    const { newState } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    expect(newState.turn_number).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/lib/battle/engine.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/battle/engine'`

- [ ] **Step 3: Write `lib/battle/engine.ts`**

```typescript
import type { BattleState, BattleCreatureData, TurnRecord, ActiveEffect } from '@/lib/battle/types'
import type { Move } from '@/lib/types'

// ── Stat helpers ─────────────────────────────────────────────────────────────

export function applyEffectToStat(
  base: number,
  stat: 'atk' | 'def' | 'spd',
  effects: ActiveEffect[],
): number {
  let value = base
  for (const e of effects) {
    if (e.turns_remaining <= 0) continue
    if (stat === 'atk' && e.effect === 'atk_down') value = Math.round(value * 0.75)
    if (stat === 'def' && e.effect === 'def_up')   value = Math.round(value * 1.25)
    if (stat === 'spd' && e.effect === 'spd_down') value = Math.round(value * 0.75)
  }
  return value
}

// ── Damage formula ────────────────────────────────────────────────────────────

export function calculateDamage(
  atk: number,
  power: number,
  def: number,
  effectiveness: number,
): number {
  return Math.max(1, Math.round((atk * power) / (def * 2) * effectiveness))
}

function getEffectiveness(
  attackingType: string,
  defendingTypes: string[],
  typeMap: Map<string, number>,
): number {
  // Use first defending type for effectiveness lookup; default 1.0
  const defending = defendingTypes[0] ?? 'unknown'
  return typeMap.get(`${attackingType}:${defending}`) ?? 1.0
}

// ── AI move selection ─────────────────────────────────────────────────────────

export function selectAiMove(
  behavior: 'aggressive' | 'defensive' | 'balanced',
  aiCreature: BattleCreatureData,
  playerCreature: BattleCreatureData,
  moves: Move[],
  typeMap: Map<string, number>,
  hpContext?: { current_hp: number; max_hp: number },
): Move {
  const attackMoves = moves.filter(m => m.move_type === 'attack' && m.power != null)
  const statusMoves = moves.filter(m => m.move_type === 'status')

  function bestByEffectiveness(candidates: Move[]): Move {
    return candidates.reduce((best, m) => {
      const eff = getEffectiveness(m.type, playerCreature.types, typeMap)
      const bestEff = getEffectiveness(best.type, playerCreature.types, typeMap)
      if (eff > bestEff) return m
      if (eff === bestEff && (m.power ?? 0) > (best.power ?? 0)) return m
      return best
    })
  }

  if (behavior === 'aggressive') {
    if (attackMoves.length === 0) return statusMoves[0] ?? moves[0]
    return attackMoves.reduce((best, m) => ((m.power ?? 0) > (best.power ?? 0) ? m : best))
  }

  if (behavior === 'defensive') {
    const isLowHp = hpContext
      ? hpContext.current_hp / hpContext.max_hp < 0.4
      : false
    if (isLowHp && statusMoves.length > 0) return statusMoves[0]
    if (attackMoves.length === 0) return statusMoves[0] ?? moves[0]
    return bestByEffectiveness(attackMoves)
  }

  // balanced
  if (moves.length === 0) throw new Error('No moves available for AI')
  return bestByEffectiveness(moves)
}

// ── Effect ticking ────────────────────────────────────────────────────────────

function tickEffects(effects: ActiveEffect[]): ActiveEffect[] {
  return effects
    .map(e => ({ ...e, turns_remaining: e.turns_remaining - 1 }))
    .filter(e => e.turns_remaining > 0)
}

function applyStatusEffect(
  move: Move,
  actorEffects: ActiveEffect[],
  targetEffects: ActiveEffect[],
): { actorEffects: ActiveEffect[]; targetEffects: ActiveEffect[] } {
  // drain is handled as a damage move in the caller; skip it here
  if (!move.status_effect || move.status_effect === 'drain' || move.move_type !== 'status') {
    return { actorEffects, targetEffects }
  }
  const effect = move.status_effect
  const newEffect: ActiveEffect = { effect, turns_remaining: 3 }

  const isActorEffect = effect === 'def_up'
  if (isActorEffect) {
    // Replace existing same effect or add
    const filtered = actorEffects.filter(e => e.effect !== effect)
    return { actorEffects: [...filtered, newEffect], targetEffects }
  } else {
    const filtered = targetEffects.filter(e => e.effect !== effect)
    return { actorEffects, targetEffects: [...filtered, newEffect] }
  }
}

// ── Turn resolution ───────────────────────────────────────────────────────────

interface ResolveResult {
  newState: BattleState
  playerTurn: TurnRecord
  aiTurn: TurnRecord
  battleOver: boolean
  winner: 'player' | 'trainer' | null
}

export function resolveTurn(
  state: BattleState,
  playerMoveId: string,
  aiMoveId: string,
  creatures: Map<string, BattleCreatureData>,
  typeMap: Map<string, number>,
): ResolveResult {
  // Clone state deeply (plain JSONB structure)
  let s: BattleState = JSON.parse(JSON.stringify(state))

  const playerCreatureId = s.player_team[s.player_active_slot].creature_id
  const trainerCreatureId = s.trainer_team[s.trainer_active_slot].creature_id

  const playerData = creatures.get(playerCreatureId)!
  const trainerData = creatures.get(trainerCreatureId)!

  const playerMove = playerData.moves.find(m => m.id === playerMoveId)!
  const trainerMove = trainerData.moves.find(m => m.id === aiMoveId)!

  const effectivePlayerSpd = applyEffectToStat(playerData.spd, 'spd', s.player_effects)
  const effectiveTrainerSpd = applyEffectToStat(trainerData.spd, 'spd', s.trainer_effects)

  // Determine order: higher spd goes first; tie = random
  const playerFirst = effectivePlayerSpd > effectiveTrainerSpd
    ? true
    : effectivePlayerSpd < effectiveTrainerSpd
      ? false
      : Math.random() < 0.5

  const turns: TurnRecord[] = []
  let battleOver = false
  let winner: 'player' | 'trainer' | null = null

  function resolveSingleMove(
    actorSide: 'player' | 'trainer',
    move: Move,
  ): TurnRecord {
    const actorCreatureId = actorSide === 'player' ? playerCreatureId : trainerCreatureId
    const actorData = actorSide === 'player' ? playerData : trainerData
    const targetSide = actorSide === 'player' ? 'trainer' : 'player'

    const actorEffects = actorSide === 'player' ? s.player_effects : s.trainer_effects
    const targetEffects = actorSide === 'player' ? s.trainer_effects : s.player_effects
    const targetTeam = actorSide === 'player' ? s.trainer_team : s.player_team
    const targetActiveSlot = actorSide === 'player' ? s.trainer_active_slot : s.player_active_slot
    const targetData = actorSide === 'player' ? trainerData : playerData

    const effectiveAtk = applyEffectToStat(actorData.atk, 'atk', actorEffects)
    const effectiveDef = applyEffectToStat(targetData.def, 'def', targetEffects)

    let damage: number | null = null
    let fainted = false
    let effectiveness = 1.0

    // Drain is treated as a damage move even when move_type='status' (it deals damage + heals)
    const isDamageMove = (move.move_type === 'attack' && move.power != null) ||
                         (move.status_effect === 'drain' && move.power != null)

    if (isDamageMove && move.power != null) {
      effectiveness = getEffectiveness(move.type, targetData.types, typeMap)
      damage = calculateDamage(effectiveAtk, move.power, effectiveDef, effectiveness)
      targetTeam[targetActiveSlot].current_hp = Math.max(0, targetTeam[targetActiveSlot].current_hp - damage)

      // Drain: heal attacker for 50% of damage dealt
      if (move.status_effect === 'drain') {
        const heal = Math.round(damage * 0.5)
        const actorTeam = actorSide === 'player' ? s.player_team : s.trainer_team
        const actorActiveSlot = actorSide === 'player' ? s.player_active_slot : s.trainer_active_slot
        actorTeam[actorActiveSlot].current_hp = Math.min(
          actorTeam[actorActiveSlot].max_hp,
          actorTeam[actorActiveSlot].current_hp + heal,
        )
      }

      if (targetTeam[targetActiveSlot].current_hp <= 0) {
        fainted = true
        // Try to advance active slot
        const nextSlot = targetSide === 'player'
          ? s.player_active_slot + 1
          : s.trainer_active_slot + 1
        const totalSlots = targetTeam.length

        if (nextSlot >= totalSlots) {
          battleOver = true
          winner = actorSide === 'player' ? 'player' : 'trainer'
        } else {
          if (targetSide === 'player') s.player_active_slot = nextSlot
          else s.trainer_active_slot = nextSlot
        }
      }
    } else if (move.move_type === 'status' && move.status_effect !== 'drain') {
      // Pure stat-effect moves: atk_down, def_up, spd_down
      const updated = applyStatusEffect(move, actorEffects, targetEffects)
      if (actorSide === 'player') {
        s.player_effects = updated.actorEffects
        s.trainer_effects = updated.targetEffects
      } else {
        s.trainer_effects = updated.actorEffects
        s.player_effects = updated.targetEffects
      }
    }

    return {
      actor: actorSide,
      creature_id: actorCreatureId,
      move_id: move.id,
      damage,
      effectiveness,
      chronicle_text: '',  // filled by templates layer
      fainted,
    }
  }

  const firstSide = playerFirst ? 'player' : 'trainer'
  const secondSide = playerFirst ? 'trainer' : 'player'
  const firstMove = playerFirst ? playerMove : trainerMove
  const secondMove = playerFirst ? trainerMove : playerMove

  const firstTurn = resolveSingleMove(firstSide, firstMove)
  turns.push(firstTurn)

  if (!battleOver) {
    const secondTurn = resolveSingleMove(secondSide, secondMove)
    turns.push(secondTurn)
  } else {
    // Second mover didn't get to act — push a no-op placeholder for API symmetry
    turns.push({
      actor: secondSide as 'player' | 'trainer',
      creature_id: secondSide === 'player' ? playerCreatureId : trainerCreatureId,
      move_id: secondSide === 'player' ? playerMove.id : trainerMove.id,
      damage: null,
      effectiveness: 1.0,
      chronicle_text: '',
      fainted: false,
    })
  }

  // Tick effects after full round
  s.player_effects = tickEffects(s.player_effects)
  s.trainer_effects = tickEffects(s.trainer_effects)

  s.turn_number += 1

  const playerTurn = playerFirst ? turns[0] : turns[1]
  const aiTurn = playerFirst ? turns[1] : turns[0]

  return { newState: s, playerTurn, aiTurn, battleOver, winner }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/lib/battle/engine.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/battle/engine.ts tests/lib/battle/engine.test.ts
git commit -m "feat: add battle engine with pure functions and unit tests"
```

---

## Task 4: Chronicle templates

**Files:**
- Create: `lib/battle/templates.ts`

> **Context:** These produce the `chronicle_text` strings stored in `battle_turns` rows. One sentence per event. No Claude calls — pure string formatting.

- [ ] **Step 1: Write `lib/battle/templates.ts`**

```typescript
import type { TurnRecord } from '@/lib/battle/types'

export function attackChronicle(
  attackerName: string,
  moveName: string,
  targetName: string,
  damage: number,
  effectiveness: number,
): string {
  const verb =
    effectiveness > 1.0 ? 'finds a weakness in'
    : effectiveness < 1.0 ? 'glances off'
    : 'strikes'

  if (effectiveness > 1.0) {
    return `${attackerName} unleashes ${moveName} and finds a weakness in ${targetName} — ${damage} damage.`
  }
  if (effectiveness < 1.0) {
    return `${attackerName}'s ${moveName} glances off ${targetName} — ${damage} damage.`
  }
  return `${attackerName} strikes ${targetName} with ${moveName} — ${damage} damage.`
}

export function drainChronicle(
  userName: string,
  moveName: string,
  targetName: string,
  damage: number,
  absorbed: number,
): string {
  return `${moveName} drains ${targetName}'s vitality — ${damage} dealt, ${absorbed} absorbed by ${userName}.`
}

export function statusChronicle(
  userName: string,
  moveName: string,
  targetName: string,
  effect: 'atk_down' | 'def_up' | 'spd_down' | 'drain',
): string {
  switch (effect) {
    case 'atk_down':
      return `${moveName} strips the edge from ${targetName}'s strikes.`
    case 'def_up':
      return `${moveName} hardens ${userName}'s defenses.`
    case 'spd_down':
      return `${moveName} slows ${targetName}'s movement.`
    case 'drain':
      return `${moveName} drains ${targetName}'s vitality.`
  }
}

export function faintChronicle(name: string): string {
  return `${name} falls.`
}

export function battleEndChronicle(winner: 'player' | 'trainer', trainerName: string): string {
  if (winner === 'player') {
    return `${trainerName} is overcome. The seal holds — for now.`
  }
  return `Your creatures are spent. The darkness advances.`
}

// Build chronicle_text for a TurnRecord given creature names
export function buildChronicle(
  turn: TurnRecord,
  attackerName: string,
  targetName: string,
  moveType: 'attack' | 'status',
  moveName: string,
  statusEffect: 'atk_down' | 'def_up' | 'spd_down' | 'drain' | null,
  faintedName: string | null,
): string[] {
  const lines: string[] = []

  if (moveType === 'attack' && turn.damage != null) {
    if (statusEffect === 'drain') {
      const absorbed = Math.round(turn.damage * 0.5)
      lines.push(drainChronicle(attackerName, moveName, targetName, turn.damage, absorbed))
    } else {
      lines.push(attackChronicle(attackerName, moveName, targetName, turn.damage, turn.effectiveness))
    }
  } else if (moveType === 'status' && statusEffect && statusEffect !== 'drain') {
    lines.push(statusChronicle(attackerName, moveName, targetName, statusEffect))
  }

  if (faintedName) {
    lines.push(faintChronicle(faintedName))
  }

  return lines
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/battle/templates.ts
git commit -m "feat: add battle chronicle templates"
```

---

## Task 5: Queries — vault, trainers, battle

**Files:**
- Modify: `lib/supabase/queries.ts`

- [ ] **Step 1: Add three new query functions**

Append to the bottom of `lib/supabase/queries.ts`:

```typescript
import type { Trainer } from '@/lib/battle/types'

export async function getVaultCreatures(): Promise<Creature[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('getVaultCreatures: not authenticated')

  const { data, error } = await supabase
    .from('creatures')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getVaultCreatures: ${error.message}`)
  return (data ?? []) as Creature[]
}

export async function getTrainers(): Promise<Trainer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trainers')
    .select('*')
    .order('gate_key')

  if (error) throw new Error(`getTrainers: ${error.message}`)
  return (data ?? []) as Trainer[]
}

export interface BattleWithState {
  id: string
  type: string
  challenger_id: string
  trainer_id: string | null
  status: string
  winner_id: string | null
  battle_state: import('@/lib/battle/types').BattleState | null
  created_at: string
  trainer: Trainer | null
  battle_teams: {
    user_id: string
    creature_id: string
    slot: number
  }[]
}

export async function getBattle(id: string): Promise<BattleWithState | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('battles')
    .select(`
      *,
      trainer:trainers (*),
      battle_teams (user_id, creature_id, slot)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as BattleWithState
}
```

Also add `Trainer` to the import at the top of `queries.ts`:

```typescript
import type { Creature, CreatureWithMoves, Move } from '@/lib/types'
// Add this import:
import type { Trainer } from '@/lib/battle/types'
```

> **Note:** The `Trainer` import will be used by the new functions but TypeScript may complain if the import appears after usage — place it with the other imports at the top of the file.

- [ ] **Step 2: Run the test suite to make sure nothing broke**

```bash
npx vitest run
```

Expected: All existing tests pass. No new tests for queries (they are thin wrappers; coverage comes from API route tests).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: add getVaultCreatures, getTrainers, getBattle queries"
```

---

## Task 6: POST /api/battle/create

**Files:**
- Create: `app/api/battle/create/route.ts`
- Create: `tests/api/battle-create.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/api/battle-create.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const TRAINER_ID = '00000000-0000-0000-0000-aaaaaaaaaaaa'
const CREATURE_1 = '00000000-0000-0000-0000-bbbbbbbbbb01'
const CREATURE_2 = '00000000-0000-0000-0000-bbbbbbbbbb02'
const BATTLE_ID  = '00000000-0000-0000-0000-cccccccccccc'
const USER_ID    = 'user-1'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function makeSupabase({
  user = { id: USER_ID } as { id: string } | null,
  trainerError = null as unknown,
  trainerData = { id: TRAINER_ID } as unknown,
  playerCreaturesData = [
    { id: CREATURE_1, creator_id: USER_ID, hp: 45, atk: 40, def: 50, spd: 35, types: ['Undead'], creature_moves: [] },
    { id: CREATURE_2, creator_id: USER_ID, hp: 55, atk: 50, def: 45, spd: 40, types: ['Elemental'], creature_moves: [] },
  ] as unknown[],
  trainerCreaturesData = [
    { creature_id: 'tc-1', slot: 1, creature: { id: 'tc-1', hp: 70, atk: 60, def: 55, spd: 50, creature_moves: [] } },
  ] as unknown[],
  battleInsertData = { id: BATTLE_ID } as unknown,
  battleInsertError = null as unknown,
  teamsInsertError = null as unknown,
} = {}) {
  const singleTrainer = vi.fn().mockResolvedValue({ data: trainerData, error: trainerError })
  const trainerSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleTrainer }) })

  const playerCreaturesSelect = vi.fn().mockResolvedValue({ data: playerCreaturesData, error: null })

  const trainerCreaturesSelect = vi.fn().mockResolvedValue({ data: trainerCreaturesData, error: null })

  const battleSingle = vi.fn().mockResolvedValue({ data: battleInsertData, error: battleInsertError })
  const battleSelect = vi.fn().mockReturnValue({ single: battleSingle })
  const battleInsert = vi.fn().mockReturnValue({ select: battleSelect })

  const teamsInsert = vi.fn().mockResolvedValue({ error: teamsInsertError })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trainers') return { select: trainerSelect }
      if (table === 'trainer_creatures') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: trainerCreaturesData, error: null }) }) }) }
      if (table === 'creatures') return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: playerCreaturesData, error: null }) }) }
      if (table === 'battles') return { insert: battleInsert }
      if (table === 'battle_teams') return { insert: teamsInsert }
      return {}
    }),
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/battle/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/battle/create', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as any)
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ user: null }) as any)
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [CREATURE_1] }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when trainer_id is missing', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ creature_slots: [CREATURE_1] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when creature_slots is empty', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when creature_slots has more than 6', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: ['a','b','c','d','e','f','g'] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when duplicate creature IDs', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [CREATURE_1, CREATURE_1] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 200 with battle id on success', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [CREATURE_1] }) as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(BATTLE_ID)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/api/battle-create.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/battle/create/route'`

- [ ] **Step 3: Write `app/api/battle/create/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BattleState, BattleCreature } from '@/lib/battle/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { trainer_id?: string; creature_slots?: string[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { trainer_id, creature_slots = [] } = body

  if (!trainer_id) {
    return NextResponse.json({ error: 'trainer_id is required' }, { status: 400 })
  }
  if (creature_slots.length === 0 || creature_slots.length > 6) {
    return NextResponse.json({ error: 'creature_slots must have 1–6 items' }, { status: 400 })
  }
  if (new Set(creature_slots).size !== creature_slots.length) {
    return NextResponse.json({ error: 'Duplicate creature IDs' }, { status: 400 })
  }

  // Validate trainer exists
  const { data: trainer, error: trainerError } = await supabase
    .from('trainers')
    .select('id')
    .eq('id', trainer_id)
    .single()

  if (trainerError || !trainer) {
    return NextResponse.json({ error: 'Trainer not found' }, { status: 400 })
  }

  // Load player's creatures (validates ownership via creator_id)
  const { data: playerCreatures, error: pcError } = await supabase
    .from('creatures')
    .select('id, hp, atk, def, spd, types, creator_id, creature_moves(slot, move_id)')
    .in('id', creature_slots)

  if (pcError || !playerCreatures) {
    return NextResponse.json({ error: 'Failed to load creatures' }, { status: 500 })
  }

  // Verify all creatures belong to this player
  const notOwned = playerCreatures.filter((c: any) => c.creator_id !== user.id)
  if (notOwned.length > 0 || playerCreatures.length !== creature_slots.length) {
    return NextResponse.json({ error: 'One or more creatures not owned by player' }, { status: 400 })
  }

  // Load trainer creatures
  const { data: trainerCreatures, error: tcError } = await supabase
    .from('trainer_creatures')
    .select('creature_id, slot, creature:creatures(id, hp, atk, def, spd, types, creature_moves(slot, move_id))')
    .eq('trainer_id', trainer_id)
    .order('slot')

  if (tcError || !trainerCreatures) {
    return NextResponse.json({ error: 'Failed to load trainer creatures' }, { status: 500 })
  }

  // Build initial battle_state
  const playerTeam: BattleCreature[] = creature_slots.map((cid, i) => {
    const c = playerCreatures.find((p: any) => p.id === cid)!
    return { creature_id: cid, current_hp: c.hp, max_hp: c.hp, slot: i + 1 }
  })

  const trainerTeam: BattleCreature[] = trainerCreatures.map((tc: any) => ({
    creature_id: tc.creature_id,
    current_hp: tc.creature.hp,
    max_hp: tc.creature.hp,
    slot: tc.slot,
  }))

  const initialState: BattleState = {
    player_team: playerTeam,
    player_active_slot: 0,
    player_effects: [],
    trainer_team: trainerTeam,
    trainer_active_slot: 0,
    trainer_effects: [],
    turn_number: 0,
  }

  // Insert battle
  const { data: battle, error: battleError } = await supabase
    .from('battles')
    .insert({
      type: 'vs-ai',
      challenger_id: user.id,
      trainer_id,
      status: 'active',
      battle_state: initialState,
    })
    .select('id')
    .single()

  if (battleError || !battle) {
    console.error('[battle/create] Insert failed:', battleError)
    return NextResponse.json({ error: 'create-failed' }, { status: 500 })
  }

  // Insert battle_teams for player
  const teamRows = creature_slots.map((cid, i) => ({
    battle_id: battle.id,
    user_id: user.id,
    creature_id: cid,
    slot: i + 1,
  }))

  const { error: teamsError } = await supabase.from('battle_teams').insert(teamRows)
  if (teamsError) {
    console.error('[battle/create] Teams insert failed:', teamsError)
    return NextResponse.json({ error: 'create-failed' }, { status: 500 })
  }

  return NextResponse.json({ id: battle.id })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/api/battle-create.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/battle/create/route.ts tests/api/battle-create.test.ts
git commit -m "feat: add POST /api/battle/create"
```

---

## Task 7: POST /api/battle/[id]/turn

**Files:**
- Create: `app/api/battle/[id]/turn/route.ts`
- Create: `tests/api/battle-turn.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/api/battle-turn.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BattleState } from '@/lib/battle/types'

const USER_ID    = 'user-1'
const BATTLE_ID  = 'battle-abc'
const MOVE_ID    = '00000000-0000-0000-0000-000000000015'  // Hollow Gaze (atk_down, status)
const CREATURE_1 = '00000000-0000-0000-0000-000000000115'  // Ash Wraith

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const baseState: BattleState = {
  player_team: [{ creature_id: CREATURE_1, current_hp: 45, max_hp: 45, slot: 1 }],
  player_active_slot: 0,
  player_effects: [],
  trainer_team: [{ creature_id: '00000000-0000-0000-0000-000000000116', current_hp: 75, max_hp: 75, slot: 1 }],
  trainer_active_slot: 0,
  trainer_effects: [],
  turn_number: 1,
}

function makeSupabase({
  user = { id: USER_ID } as { id: string } | null,
  battle = {
    id: BATTLE_ID,
    challenger_id: USER_ID,
    status: 'active',
    trainer_id: 'trainer-1',
    battle_state: baseState,
    trainer: { id: 'trainer-1', ai_behavior: 'aggressive' },
  } as unknown,
  battleError = null as unknown,
} = {}) {
  const singleBattle = vi.fn().mockResolvedValue({ data: battle, error: battleError })
  const battleChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: singleBattle,
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }

  const creatureSelect = vi.fn().mockResolvedValue({
    data: [
      {
        id: CREATURE_1,
        name: 'Ash Wraith', types: ['Undead', 'Elemental'],
        hp: 45, atk: 60, def: 45, spd: 70,
        creature_moves: [
          { slot: 1, move: { id: MOVE_ID, name: 'Hollow Gaze', type: 'Undead', power: null, move_type: 'status', status_effect: 'atk_down', description: 'x' } },
          { slot: 2, move: { id: '00000000-0000-0000-0000-000000000034', name: 'Ashen Touch', type: 'Elemental', power: 50, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 3, move: { id: '00000000-0000-0000-0000-000000000035', name: 'Smoldering Wail', type: 'Undead', power: 60, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 4, move: { id: '00000000-0000-0000-0000-000000000036', name: 'Cinder Cloak', type: 'Elemental', power: null, move_type: 'status', status_effect: 'def_up', description: 'x' } },
        ],
      },
      {
        id: '00000000-0000-0000-0000-000000000116',
        name: 'Drowned Reliquary', types: ['Aberration', 'Elemental'],
        hp: 75, atk: 65, def: 60, spd: 40,
        creature_moves: [
          { slot: 1, move: { id: '00000000-0000-0000-0000-000000000037', name: 'Names of the Drowned', type: 'Aberration', power: 65, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 2, move: { id: '00000000-0000-0000-0000-000000000038', name: 'Brackish Embrace', type: 'Aberration', power: 70, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 3, move: { id: '00000000-0000-0000-0000-000000000039', name: "Reliquary's Curse", type: 'Aberration', power: null, move_type: 'status', status_effect: 'spd_down', description: 'x' } },
          { slot: 4, move: { id: '00000000-0000-0000-0000-000000000005', name: 'Drowning Tide', type: 'Elemental', power: 75, move_type: 'attack', status_effect: null, description: 'x' } },
        ],
      },
    ],
    error: null,
  })

  const typeEffSelect = vi.fn().mockResolvedValue({
    data: [
      { attacking_type: 'Undead', defending_type: 'Elemental', modifier: 0.5 },
      { attacking_type: 'Elemental', defending_type: 'Undead', modifier: 2.0 },
      { attacking_type: 'Aberration', defending_type: 'Undead', modifier: 0.5 },
    ],
    error: null,
  })

  const turnsInsert = vi.fn().mockResolvedValue({ error: null })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'battles') return battleChain
      if (table === 'creatures') return { select: creatureSelect }
      if (table === 'type_effectiveness') return { select: typeEffSelect }
      if (table === 'battle_turns') return { insert: turnsInsert }
      return {}
    }),
  }
}

function makeRequest(body: unknown, id = BATTLE_ID) {
  return {
    json: async () => body,
    params: Promise.resolve({ id }),
  }
}

describe('POST /api/battle/[id]/turn', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as any)
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ user: null }) as any)
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when battle not found', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ battle: null, battleError: { message: 'not found' } }) as any)
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(404)
  })

  it('returns 400 when battle is already complete', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({
      battle: { id: BATTLE_ID, challenger_id: USER_ID, status: 'complete', trainer_id: 'trainer-1', battle_state: baseState, trainer: { id: 'trainer-1', ai_behavior: 'aggressive' } },
    }) as any)
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when move_id is not in active creature moves', async () => {
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: 'invalid-move-id' }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(400)
  })

  it('returns 200 with state, playerTurn, aiTurn on success', async () => {
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBeDefined()
    expect(body.playerTurn).toBeDefined()
    expect(body.aiTurn).toBeDefined()
    expect(typeof body.battleOver).toBe('boolean')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/api/battle-turn.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/battle/[id]/turn/route'`

- [ ] **Step 3: Write `app/api/battle/[id]/turn/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { selectAiMove, resolveTurn } from '@/lib/battle/engine'
import { buildChronicle, battleEndChronicle } from '@/lib/battle/templates'
import type { BattleCreatureData } from '@/lib/battle/types'
import type { Move } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { move_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { move_id } = body

  // Load battle
  const { data: battle, error: battleError } = await supabase
    .from('battles')
    .select('*, trainer:trainers(*)')
    .eq('id', id)
    .single()

  if (battleError || !battle || battle.challenger_id !== user.id) {
    return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  }
  if (battle.status !== 'active') {
    return NextResponse.json({ error: 'Battle is not active' }, { status: 400 })
  }

  const state = battle.battle_state
  const activePlayerCreatureId = state.player_team[state.player_active_slot].creature_id
  const activeTrainerCreatureId = state.trainer_team[state.trainer_active_slot].creature_id

  // Load all creature data needed for resolution
  const allCreatureIds = [
    ...state.player_team.map((c: any) => c.creature_id),
    ...state.trainer_team.map((c: any) => c.creature_id),
  ]

  const { data: creaturesRaw, error: cError } = await supabase
    .from('creatures')
    .select('id, name, types, hp, atk, def, spd, creature_moves(slot, move:moves(*))')
    .in('id', allCreatureIds)

  if (cError || !creaturesRaw) {
    return NextResponse.json({ error: 'Failed to load creature data' }, { status: 500 })
  }

  // Build creatures Map
  const creatures = new Map<string, BattleCreatureData>()
  for (const c of creaturesRaw as any[]) {
    const moves: Move[] = (c.creature_moves as any[])
      .sort((a: any, b: any) => a.slot - b.slot)
      .map((cm: any) => cm.move)
    creatures.set(c.id, {
      id: c.id,
      name: c.name,
      types: c.types,
      hp: c.hp,
      atk: c.atk,
      def: c.def,
      spd: c.spd,
      moves,
    })
  }

  // Validate player's move
  const playerCreatureData = creatures.get(activePlayerCreatureId)
  if (!playerCreatureData) {
    return NextResponse.json({ error: 'Active creature not found' }, { status: 500 })
  }
  const playerMove = playerCreatureData.moves.find(m => m.id === move_id)
  if (!playerMove) {
    return NextResponse.json({ error: 'Invalid move for active creature' }, { status: 400 })
  }

  // Load type effectiveness
  const { data: typeRows } = await supabase.from('type_effectiveness').select('*')
  const typeMap = new Map<string, number>()
  for (const row of (typeRows ?? []) as any[]) {
    typeMap.set(`${row.attacking_type}:${row.defending_type}`, Number(row.modifier))
  }

  // AI picks move
  const trainerCreatureData = creatures.get(activeTrainerCreatureId)!
  const trainer = battle.trainer as any
  const trainerHpContext = state.trainer_team[state.trainer_active_slot]
  const aiMove = selectAiMove(
    trainer.ai_behavior,
    trainerCreatureData,
    playerCreatureData,
    trainerCreatureData.moves,
    typeMap,
    { current_hp: trainerHpContext.current_hp, max_hp: trainerHpContext.max_hp },
  )

  // Resolve turn
  const { newState, playerTurn, aiTurn, battleOver, winner } = resolveTurn(
    state,
    playerMove.id,
    aiMove.id,
    creatures,
    typeMap,
  )

  // Build chronicle text
  function buildTurnChronicle(
    turn: typeof playerTurn,
    move: Move,
    attackerName: string,
    targetName: string,
  ): string {
    const faintedName = turn.fainted
      ? (turn.actor === 'player'
          ? trainerCreatureData.name
          : playerCreatureData.name)
      : null
    const lines = buildChronicle(
      turn,
      attackerName,
      targetName,
      move.move_type,
      move.name,
      move.status_effect,
      faintedName,
    )
    return lines.join(' ')
  }

  const playerChronicle = buildTurnChronicle(
    playerTurn,
    playerMove,
    playerCreatureData.name,
    trainerCreatureData.name,
  )
  const aiChronicle = buildTurnChronicle(
    aiTurn,
    aiMove,
    trainerCreatureData.name,
    playerCreatureData.name,
  )

  playerTurn.chronicle_text = playerChronicle
  aiTurn.chronicle_text = aiChronicle

  // Insert battle_turns
  const turnRows = [
    {
      battle_id: id,
      turn_number: state.turn_number,
      acting_user_id: user.id,
      creature_id: playerTurn.creature_id,
      move_id: playerTurn.move_id,
      damage: playerTurn.damage,
      effectiveness: playerTurn.effectiveness === 2.0 ? 'strong' : playerTurn.effectiveness === 0.5 ? 'weak' : 'neutral',
      chronicle_text: playerTurn.chronicle_text,
    },
    {
      battle_id: id,
      turn_number: state.turn_number,
      acting_user_id: null,  // AI turn
      creature_id: aiTurn.creature_id,
      move_id: aiTurn.move_id,
      damage: aiTurn.damage,
      effectiveness: aiTurn.effectiveness === 2.0 ? 'strong' : aiTurn.effectiveness === 0.5 ? 'weak' : 'neutral',
      chronicle_text: aiTurn.chronicle_text,
    },
  ]

  const { error: turnsError } = await supabase.from('battle_turns').insert(turnRows)
  if (turnsError) {
    console.error('[battle/turn] Insert turns failed:', turnsError)
    return NextResponse.json({ error: 'turn-failed' }, { status: 500 })
  }

  // Update battle state
  const battleUpdate: Record<string, unknown> = { battle_state: newState }
  if (battleOver) {
    battleUpdate.status = 'complete'
    battleUpdate.winner_id = winner === 'player' ? user.id : null
  }

  await supabase.from('battles').update(battleUpdate).eq('id', id)

  // Append end-of-battle chronicle
  let endChronicle: string | null = null
  if (battleOver && winner) {
    endChronicle = battleEndChronicle(winner, trainer.name ?? 'The trainer')
  }

  return NextResponse.json({
    state: newState,
    playerTurn,
    aiTurn,
    battleOver,
    winner,
    endChronicle,
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/api/battle-turn.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/battle/[id]/turn/route.ts tests/api/battle-turn.test.ts
git commit -m "feat: add POST /api/battle/[id]/turn"
```

---

## Task 8: Vault page

**Files:**
- Create: `app/vault/page.tsx`

> **Context:** Server component. Auth guard redirects to `/login`. Filter chips use `searchParams` to filter displayed creatures. "Challenge a Trainer" links to `/battle/new`. Creatures show Approved (green badge) or Pending (grey badge).
>
> **Next.js 16 breaking change:** `searchParams` is a `Promise<...>` and MUST be awaited.

- [ ] **Step 1: Write `app/vault/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getVaultCreatures } from '@/lib/supabase/queries'
import type { Creature } from '@/lib/types'

interface VaultPageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function VaultPage({ searchParams }: VaultPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vault')

  const { filter } = await searchParams
  const creatures = await getVaultCreatures()

  const filtered =
    filter === 'approved' ? creatures.filter(c => c.approved)
    : filter === 'pending'  ? creatures.filter(c => !c.approved)
    : creatures

  function filterHref(f: string) {
    return f === filter ? '/vault' : `/vault?filter=${f}`
  }

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-4xl mx-auto">
        <a href="/bestiary" className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block">
          ← The Bestiary
        </a>

        <h1 className="text-stone-100 text-3xl font-semibold mb-1">The Vault</h1>
        <p className="text-stone-600 text-sm italic mb-6">Your creatures, recorded and waiting.</p>

        {/* Filter chips */}
        <div className="flex gap-2 mb-6">
          <a
            href="/vault"
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              !filter ? 'bg-stone-600 text-stone-100' : 'border border-stone-700 text-stone-500 hover:text-stone-300'
            }`}
          >
            All ({creatures.length})
          </a>
          <a
            href={filterHref('approved')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'approved' ? 'bg-stone-600 text-stone-100' : 'border border-stone-700 text-stone-500 hover:text-stone-300'
            }`}
          >
            Approved ({creatures.filter(c => c.approved).length})
          </a>
          <a
            href={filterHref('pending')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'pending' ? 'bg-stone-600 text-stone-100' : 'border border-stone-700 text-stone-500 hover:text-stone-300'
            }`}
          >
            Pending ({creatures.filter(c => !c.approved).length})
          </a>
        </div>

        {filtered.length === 0 ? (
          <p className="text-stone-600 text-sm italic">
            {creatures.length === 0
              ? 'No creatures yet. Visit the Forge to create your first.'
              : 'No creatures match this filter.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(creature => (
              <VaultCreatureCard key={creature.id} creature={creature} />
            ))}
          </div>
        )}

        {/* Challenge CTA */}
        <div className="mt-8 pt-6 border-t border-stone-800">
          {creatures.filter(c => c.approved).length > 0 ? (
            <a
              href="/battle/new"
              className="inline-block bg-stone-100 text-stone-950 px-4 py-2 rounded text-sm font-semibold hover:bg-stone-200 transition-colors"
            >
              Challenge a Trainer →
            </a>
          ) : (
            <p className="text-stone-600 text-xs italic">
              You need at least one approved creature to challenge a trainer.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

function VaultCreatureCard({ creature }: { creature: Creature }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-stone-100 text-sm font-semibold">{creature.name}</h2>
        {creature.approved ? (
          <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Approved</span>
        ) : (
          <span className="text-xs bg-stone-700 text-stone-400 px-2 py-0.5 rounded-full">Pending</span>
        )}
      </div>

      {creature.artwork_url && (
        <img
          src={creature.artwork_url}
          alt={creature.name}
          className="w-full h-24 object-cover rounded mb-2 opacity-80"
        />
      )}

      <p className="text-stone-600 text-xs italic mb-2 line-clamp-2">{creature.flavor_text}</p>

      <div className="flex flex-wrap gap-1 mb-2">
        {creature.types.map(t => (
          <span key={t} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded">{t}</span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1 text-center text-xs">
        {(['hp', 'atk', 'def', 'spd'] as const).map(stat => (
          <div key={stat}>
            <div className="text-stone-600 uppercase">{stat}</div>
            <div className="text-stone-300">{creature[stat]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vault/page.tsx
git commit -m "feat: add /vault page"
```

---

## Task 9: Battle components

**Files:**
- Create: `components/battle/BattleCreatureCard.tsx`
- Create: `components/battle/MoveGrid.tsx`
- Create: `components/battle/ChronicleLog.tsx`

> **Context:** These are presentational components used by `BattleArena`. Keep them dumb — no state, no API calls.

- [ ] **Step 1: Write `components/battle/BattleCreatureCard.tsx`**

```typescript
'use client'

import type { BattleCreature, BattleCreatureData } from '@/lib/battle/types'

interface Props {
  playerSlot: BattleCreature
  playerData: BattleCreatureData
  trainerSlot: BattleCreature
  trainerData: BattleCreatureData
  playerTeamSize: number
  playerAliveCount: number
  trainerTeamSize: number
  trainerAliveCount: number
}

function HpBar({ current, max, side }: { current: number; max: number; side: 'player' | 'trainer' }) {
  const pct = Math.max(0, Math.round((current / max) * 100))
  const color =
    pct > 50 ? 'bg-emerald-500'
    : pct > 20 ? 'bg-yellow-500'
    : 'bg-red-500'
  return (
    <div className="bg-stone-700 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TeamDots({ total, alive, side }: { total: number; alive: number; side: 'player' | 'trainer' }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < alive
              ? side === 'player' ? 'bg-emerald-500' : 'bg-red-500'
              : 'bg-stone-700'
          }`}
        />
      ))}
    </div>
  )
}

export function BattleCreatureCard({
  playerSlot,
  playerData,
  trainerSlot,
  trainerData,
  playerTeamSize,
  playerAliveCount,
  trainerTeamSize,
  trainerAliveCount,
}: Props) {
  return (
    <div>
      {/* Panoramic artwork banner */}
      <div className="flex h-24 rounded-lg overflow-hidden mb-3 bg-stone-900">
        <div className="flex-1 relative">
          {playerData && (
            playerSlot.current_hp > 0 ? (
              playerData.id && (
                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                  {/* artwork placeholder — replaced by actual img when available */}
                  <div className="w-16 h-16 bg-stone-700 rounded-full flex items-center justify-center text-stone-500 text-xs">
                    {playerData.name[0]}
                  </div>
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <span className="text-stone-500 text-xs">Fainted</span>
              </div>
            )
          )}
        </div>
        <div className="flex items-center px-2 text-stone-600 text-xs font-light">vs</div>
        <div className="flex-1 relative">
          {trainerData && (
            trainerSlot.current_hp > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <div className="w-16 h-16 bg-stone-700 rounded-full flex items-center justify-center text-stone-500 text-xs">
                  {trainerData.name[0]}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <span className="text-stone-500 text-xs">Fainted</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Names + HP */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-stone-100 text-sm font-semibold">{playerData.name}</span>
            <span className="text-stone-500 text-xs">{playerSlot.current_hp}/{playerSlot.max_hp}</span>
          </div>
          <HpBar current={playerSlot.current_hp} max={playerSlot.max_hp} side="player" />
          <div className="mt-1.5">
            <TeamDots total={playerTeamSize} alive={playerAliveCount} side="player" />
          </div>
        </div>
        <div className="text-right">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-stone-500 text-xs">{trainerSlot.current_hp}/{trainerSlot.max_hp}</span>
            <span className="text-stone-100 text-sm font-semibold">{trainerData.name}</span>
          </div>
          <HpBar current={trainerSlot.current_hp} max={trainerSlot.max_hp} side="trainer" />
          <div className="mt-1.5 flex justify-end">
            <TeamDots total={trainerTeamSize} alive={trainerAliveCount} side="trainer" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/battle/MoveGrid.tsx`**

```typescript
'use client'

import type { Move } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  Fiendish:   'bg-red-950 text-red-200 hover:bg-red-900',
  Elemental:  'bg-blue-950 text-blue-200 hover:bg-blue-900',
  Undead:     'bg-purple-950 text-purple-200 hover:bg-purple-900',
  Celestial:  'bg-yellow-950 text-yellow-200 hover:bg-yellow-900',
  Aberration: 'bg-teal-950 text-teal-200 hover:bg-teal-900',
  Arcane:     'bg-indigo-950 text-indigo-200 hover:bg-indigo-900',
  Fey:        'bg-pink-950 text-pink-200 hover:bg-pink-900',
  Beast:      'bg-amber-950 text-amber-200 hover:bg-amber-900',
}

const TYPE_LABEL_COLORS: Record<string, string> = {
  Fiendish:   'text-red-400',
  Elemental:  'text-blue-400',
  Undead:     'text-purple-400',
  Celestial:  'text-yellow-400',
  Aberration: 'text-teal-400',
  Arcane:     'text-indigo-400',
  Fey:        'text-pink-400',
  Beast:      'text-amber-400',
}

function effectLabel(move: Move): string {
  if (move.move_type === 'attack' && move.power != null) return `${move.power} pwr`
  if (move.status_effect === 'atk_down') return 'ATK ↓'
  if (move.status_effect === 'def_up') return 'DEF ↑'
  if (move.status_effect === 'spd_down') return 'SPD ↓'
  if (move.status_effect === 'drain') return 'Drain'
  return ''
}

interface Props {
  moves: Move[]
  onMove: (moveId: string) => void
  disabled: boolean
}

export function MoveGrid({ moves, onMove, disabled }: Props) {
  return (
    <div>
      <div className="text-stone-600 text-xs uppercase tracking-widest mb-2">Choose a move</div>
      <div className="grid grid-cols-2 gap-2">
        {moves.map(move => (
          <button
            key={move.id}
            onClick={() => onMove(move.id)}
            disabled={disabled}
            className={`text-left p-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              TYPE_COLORS[move.type] ?? 'bg-stone-800 text-stone-200 hover:bg-stone-700'
            }`}
          >
            <div className="text-sm font-semibold mb-0.5">{move.name}</div>
            <div className={`text-xs ${TYPE_LABEL_COLORS[move.type] ?? 'text-stone-400'}`}>
              {move.type} · {effectLabel(move)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `components/battle/ChronicleLog.tsx`**

```typescript
'use client'

import { useEffect, useRef } from 'react'

interface Props {
  entries: string[]
}

export function ChronicleLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 h-32 overflow-y-auto">
      {entries.length === 0 ? (
        <p className="text-stone-700 text-xs italic">The battle begins.</p>
      ) : (
        entries.map((entry, i) => (
          <p
            key={i}
            className={`text-xs italic mb-1 ${i === entries.length - 1 ? 'text-stone-400' : 'text-stone-600'}`}
          >
            {entry}
          </p>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/battle/BattleCreatureCard.tsx components/battle/MoveGrid.tsx components/battle/ChronicleLog.tsx
git commit -m "feat: add BattleCreatureCard, MoveGrid, ChronicleLog components"
```

---

## Task 10: TeamSelector component + /battle/new page

**Files:**
- Create: `components/battle/TeamSelector.tsx`
- Create: `app/battle/new/page.tsx`

> **Next.js 16 breaking change:** `params` and `searchParams` are `Promise<...>` and MUST be awaited. Server components: `await params`, `await searchParams` before using.

- [ ] **Step 1: Write `components/battle/TeamSelector.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Creature } from '@/lib/types'
import type { Trainer } from '@/lib/battle/types'

interface Props {
  trainer: Trainer
  ownedCreatures: Creature[]  // only approved creatures
  onCancel: () => void
}

export function TeamSelector({ trainer, ownedCreatures, onCancel }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 6 ? [...prev, id] : prev
    )
  }

  async function handleStart() {
    if (selected.length === 0) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/battle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: trainer.id, creature_slots: selected }),
      })
      if (!res.ok) throw new Error('create-failed')
      const { id } = await res.json()
      router.push(`/battle/${id}`)
    } catch {
      setError('Could not begin the battle. Try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-stone-950/90 flex items-center justify-center z-50 p-6">
      <div className="bg-stone-900 border border-stone-700 rounded-xl max-w-lg w-full p-6">
        <h2 className="text-stone-100 text-lg font-semibold mb-1">Challenge {trainer.name}</h2>
        <p className="text-stone-600 text-xs italic mb-1">{trainer.intro_text}</p>
        <p className="text-stone-500 text-xs mb-4">Select 1–6 creatures for your team.</p>

        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto mb-4">
          {ownedCreatures.map(c => {
            const isSelected = selected.includes(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-stone-400 bg-stone-800'
                    : 'border-stone-700 bg-stone-900 hover:border-stone-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-stone-200 text-sm font-medium">{c.name}</span>
                  <div className="flex gap-1">
                    {c.types.map(t => (
                      <span key={t} className="text-xs bg-stone-700 text-stone-400 px-1.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1 text-center text-xs text-stone-600">
                  <div>HP {c.hp}</div>
                  <div>ATK {c.atk}</div>
                  <div>DEF {c.def}</div>
                  <div>SPD {c.spd}</div>
                </div>
              </button>
            )
          })}
        </div>

        {error && <p className="text-red-400 text-xs italic mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-stone-700 text-stone-500 rounded py-2 text-sm hover:text-stone-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={selected.length === 0 || isLoading}
            className="flex-1 bg-stone-100 text-stone-950 rounded py-2 text-sm font-semibold disabled:opacity-40 hover:bg-stone-200 transition-colors"
          >
            {isLoading ? 'Preparing…' : `Enter the battle (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `app/battle/new/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTrainers, getVaultCreatures } from '@/lib/supabase/queries'
import { TrainerListClient } from '@/components/battle/TrainerListClient'

export default async function BattleNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/battle/new')

  const [trainers, allCreatures] = await Promise.all([getTrainers(), getVaultCreatures()])
  const approvedCreatures = allCreatures.filter(c => c.approved)

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-3xl mx-auto">
        <a href="/vault" className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block">
          ← The Vault
        </a>
        <h1 className="text-stone-100 text-3xl font-semibold mb-1">Choose a Trainer</h1>
        <p className="text-stone-600 text-sm italic mb-6">Each holds a piece of what threatens the seals.</p>

        {approvedCreatures.length === 0 && (
          <p className="text-stone-600 text-sm italic mb-6">
            You need at least one approved creature. <a href="/forge" className="text-stone-400 underline">Forge one first.</a>
          </p>
        )}

        <TrainerListClient trainers={trainers} approvedCreatures={approvedCreatures} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Write `components/battle/TrainerListClient.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { TeamSelector } from '@/components/battle/TeamSelector'
import type { Creature } from '@/lib/types'
import type { Trainer } from '@/lib/battle/types'

interface Props {
  trainers: Trainer[]
  approvedCreatures: Creature[]
}

export function TrainerListClient({ trainers, approvedCreatures }: Props) {
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {trainers.map(trainer => (
          <button
            key={trainer.id}
            onClick={() => approvedCreatures.length > 0 && setSelectedTrainer(trainer)}
            disabled={approvedCreatures.length === 0}
            className="text-left bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <h2 className="text-stone-100 text-sm font-semibold mb-1">{trainer.name}</h2>
            <p className="text-stone-600 text-xs italic mb-2">{trainer.description}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              trainer.ai_behavior === 'aggressive' ? 'bg-red-950 text-red-300'
              : trainer.ai_behavior === 'defensive' ? 'bg-blue-950 text-blue-300'
              : 'bg-stone-800 text-stone-400'
            }`}>
              {trainer.ai_behavior}
            </span>
          </button>
        ))}
      </div>

      {selectedTrainer && (
        <TeamSelector
          trainer={selectedTrainer}
          ownedCreatures={approvedCreatures}
          onCancel={() => setSelectedTrainer(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/battle/TeamSelector.tsx components/battle/TrainerListClient.tsx app/battle/new/page.tsx
git commit -m "feat: add /battle/new page with trainer selection and team selector"
```

---

## Task 11: BattleArena component + /battle/[id] page

**Files:**
- Create: `components/battle/BattleArena.tsx`
- Create: `app/battle/[id]/page.tsx`

> **Context:** `BattleArena` is a client component that manages all battle interactivity. The server component at `app/battle/[id]/page.tsx` loads initial data and hands off. `params` is a `Promise<{ id: string }>` — await it.

- [ ] **Step 1: Write `components/battle/BattleArena.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { BattleCreatureCard } from '@/components/battle/BattleCreatureCard'
import { MoveGrid } from '@/components/battle/MoveGrid'
import { ChronicleLog } from '@/components/battle/ChronicleLog'
import type { BattleState, BattleCreatureData, Trainer } from '@/lib/battle/types'
import type { Move } from '@/lib/types'

interface Props {
  battleId: string
  initialState: BattleState
  playerCreatures: BattleCreatureData[]  // all player creatures in team
  trainerCreatures: BattleCreatureData[] // all trainer creatures in team
  trainer: Trainer
}

export function BattleArena({
  battleId,
  initialState,
  playerCreatures,
  trainerCreatures,
  trainer,
}: Props) {
  const [state, setState] = useState<BattleState>(initialState)
  const [chronicle, setChronicle] = useState<string[]>([])
  const [isResolving, setIsResolving] = useState(false)
  const [battleOver, setBattleOver] = useState(false)
  const [winner, setWinner] = useState<'player' | 'trainer' | null>(null)

  const playerSlot = state.player_team[state.player_active_slot]
  const trainerSlot = state.trainer_team[state.trainer_active_slot]

  const playerData = playerCreatures.find(c => c.id === playerSlot.creature_id)!
  const trainerData = trainerCreatures.find(c => c.id === trainerSlot.creature_id)!

  const playerAliveCount = state.player_team.filter(c => c.current_hp > 0).length
  const trainerAliveCount = state.trainer_team.filter(c => c.current_hp > 0).length

  const activeMoves: Move[] = playerData?.moves ?? []

  async function handleMove(moveId: string) {
    if (isResolving || battleOver) return
    setIsResolving(true)

    try {
      const res = await fetch(`/api/battle/${battleId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move_id: moveId }),
      })

      if (!res.ok) {
        setChronicle(prev => [...prev, 'Something went wrong. Try again.'])
        return
      }

      const data = await res.json()

      // Append chronicle entries
      const newEntries: string[] = []
      if (data.playerTurn?.chronicle_text) newEntries.push(data.playerTurn.chronicle_text)
      if (data.aiTurn?.chronicle_text) newEntries.push(data.aiTurn.chronicle_text)
      if (data.endChronicle) newEntries.push(data.endChronicle)
      setChronicle(prev => [...prev, ...newEntries])

      setState(data.state)

      if (data.battleOver) {
        setBattleOver(true)
        setWinner(data.winner)
      }
    } finally {
      setIsResolving(false)
    }
  }

  if (battleOver) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <p className="text-stone-300 text-xl mb-3">
            {winner === 'player'
              ? `${trainer.name} is overcome. The seal holds — for now.`
              : 'Your creatures are spent. The darkness advances.'}
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-6 max-h-40 overflow-y-auto text-left">
            {chronicle.slice(-5).map((e, i) => (
              <p key={i} className="text-stone-600 text-xs italic mb-1">{e}</p>
            ))}
          </div>
          <div className="flex gap-4 justify-center">
            <a href="/vault" className="text-stone-500 text-sm hover:text-stone-300 transition-colors">
              ← Return to Vault
            </a>
            <a href="/battle/new" className="text-stone-300 text-sm hover:text-stone-100 transition-colors">
              Challenge Again →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-stone-950 p-6">
      <div className="max-w-lg mx-auto">
        {/* Trainer info */}
        <div className="text-stone-600 text-xs mb-4 text-center">{trainer.name}</div>

        {/* Creature card */}
        <div className="mb-4">
          <BattleCreatureCard
            playerSlot={playerSlot}
            playerData={playerData}
            trainerSlot={trainerSlot}
            trainerData={trainerData}
            playerTeamSize={state.player_team.length}
            playerAliveCount={playerAliveCount}
            trainerTeamSize={state.trainer_team.length}
            trainerAliveCount={trainerAliveCount}
          />
        </div>

        {/* Chronicle */}
        <div className="mb-4">
          <ChronicleLog entries={chronicle} />
        </div>

        {/* Moves */}
        {isResolving ? (
          <div className="text-stone-600 text-xs italic text-center py-4">Resolving…</div>
        ) : (
          <MoveGrid
            moves={activeMoves}
            onMove={handleMove}
            disabled={isResolving || battleOver}
          />
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Write `app/battle/[id]/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBattle } from '@/lib/supabase/queries'
import { BattleArena } from '@/components/battle/BattleArena'
import type { BattleCreatureData } from '@/lib/battle/types'
import type { Move } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BattlePage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/battle/${id}`)

  const battle = await getBattle(id)
  if (!battle || battle.challenger_id !== user.id) notFound()
  if (!battle.battle_state) notFound()

  // Load all creature data for the battle (player team + trainer team)
  const allCreatureIds = [
    ...battle.battle_state.player_team.map(c => c.creature_id),
    ...battle.battle_state.trainer_team.map(c => c.creature_id),
  ]

  const { data: creaturesRaw } = await supabase
    .from('creatures')
    .select('id, name, types, hp, atk, def, spd, creature_moves(slot, move:moves(*))')
    .in('id', allCreatureIds)

  const creatures: BattleCreatureData[] = (creaturesRaw ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    types: c.types,
    hp: c.hp,
    atk: c.atk,
    def: c.def,
    spd: c.spd,
    moves: (c.creature_moves as any[])
      .sort((a: any, b: any) => a.slot - b.slot)
      .map((cm: any) => cm.move as Move),
  }))

  const playerCreatureIds = new Set(battle.battle_state.player_team.map(c => c.creature_id))
  const playerCreatures = creatures.filter(c => playerCreatureIds.has(c.id))
  const trainerCreatures = creatures.filter(c => !playerCreatureIds.has(c.id))

  return (
    <BattleArena
      battleId={id}
      initialState={battle.battle_state}
      playerCreatures={playerCreatures}
      trainerCreatures={trainerCreatures}
      trainer={battle.trainer!}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/battle/BattleArena.tsx app/battle/[id]/page.tsx
git commit -m "feat: add BattleArena component and /battle/[id] page"
```

---

## Task 12: Seed trainer data

**Files:**
- Modify: `supabase/seed.sql`

> **Context:** The `trainers` table exists but has no data. Trainers need to be seeded for the battle flow to work. Add trainers referencing the campaign gate keys from seed.sql. Trainer creatures reference canon creatures from seed.sql (IDs `000000000101–000000000120`).

- [ ] **Step 1: Append trainer seed data to `supabase/seed.sql`**

Append the following to the end of `supabase/seed.sql`:

```sql
-- TRAINERS
-- IDs: 00000000-0000-0000-0000-000000000201 through 000000000204
insert into trainers (id, name, description, intro_text, win_text, loss_text, ai_behavior, gate_key) values
  ('00000000-0000-0000-0000-000000000201',
   'Thessalmar''s Vessel',
   'A cultist who has swallowed so much of the Drowned''s power they have become something else.',
   'You smell of the surface. That will not help you here.',
   'Something in you refused the tide. It will not refuse forever.',
   'The depths reclaim what they are owed.',
   'defensive',
   'seal-of-water'),

  ('00000000-0000-0000-0000-000000000202',
   'Herald of the Storm Eater',
   'One of Silvaclaw''s human heralds. They have eaten lightning and survived. Mostly.',
   'Silvaclaw does not stop for weather. Neither do I.',
   'The storm noted you. That is not a compliment.',
   'The lightning finds another path.',
   'aggressive',
   'stormcrest-spire'),

  ('00000000-0000-0000-0000-000000000203',
   'Vexmire''s Penitent',
   'A fallen cleric who chose the Dawnsbane over the Radiant One. The vestments are still intact.',
   'The Radiant One is dead. Her seal is next.',
   'Your conviction is inconvenient.',
   'The seal cracks a little further.',
   'balanced',
   'radiant-temple'),

  ('00000000-0000-0000-0000-000000000204',
   'Shadow-sworn Initiate',
   'A monk of the Umbral Vault who has taken Nyx''s mark. Their shadow moves separately from them now.',
   'The vault does not open for strangers. But it opens for me.',
   'Something in the vault stirred. That is unusual.',
   'The darkness closes behind you.',
   'balanced',
   'umbral-vault')
on conflict (id) do nothing;

-- TRAINER CREATURES
insert into trainer_creatures (trainer_id, creature_id, slot) values
  -- Thessalmar's Vessel: Drowned Reliquary, Brackish Wyrmling, Half-dragon Servant
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000116', 1),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000107', 2),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000111', 3),

  -- Herald of the Storm Eater: Stormcrest Sentinel, Storm Wyrmling, Dragonclaw
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000118', 1),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000108', 2),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000112', 3),

  -- Vexmire's Penitent: Hollow Saint, Ash Wraith, Dragon Fang
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000117', 1),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000115', 2),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000113', 3),

  -- Shadow-sworn Initiate: Shadow-touched Monk, Shadowborn Wyrmling, Wyrmspeaker
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000119', 1),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000110', 2),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000114', 3)
on conflict do nothing;
```

- [ ] **Step 2: Push seed data to database**

```bash
npx supabase db reset
```

Or if you only want to run the new seed rows without resetting:
```bash
# Connect to your Supabase project and run the new SQL directly in the SQL editor
# OR push with: npx supabase db push --include-seed
```

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: seed trainer data and trainer creature rosters"
```

---

## Task 13: Final test run + navigation links

**Files:**
- Modify: `app/layout.tsx` or wherever the nav lives

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Check if a nav link to /vault is needed**

```bash
# Read the layout file to see if there is a nav
```

Read `app/layout.tsx`. If there is a nav with links (e.g., "The Bestiary", "The Forge"), add "The Vault":

```typescript
// In whatever nav component or layout contains the links:
<a href="/vault" className="text-stone-500 text-sm hover:text-stone-300 transition-colors">
  The Vault
</a>
```

If there is no nav, skip this step.

- [ ] **Step 3: Commit (if nav was updated)**

```bash
git add app/layout.tsx
git commit -m "feat: add Vault link to navigation"
```

- [ ] **Step 4: Final commit message**

```bash
git log --oneline -10
```

Verify all commits are present and clean.
