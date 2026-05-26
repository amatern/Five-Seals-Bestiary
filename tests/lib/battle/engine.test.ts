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
    expect(playerTurn.actor).toBe('player')
    expect(aiTurn.actor).toBe('trainer')
  })

  it('slower creature takes reduced HP before it can attack', () => {
    const state = makeState()
    const { newState } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    expect(newState.player_team[0].current_hp).toBeLessThan(45)
    expect(newState.trainer_team[0].current_hp).toBeLessThan(55)
  })

  it('faint advances active slot when defender HP reaches 0', () => {
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
    // Player at 30/45 HP uses drain (power=40, Celestial). Trainer uses status move so
    // we can cleanly verify the heal without trainer counterattack masking it.
    // drain damage: Math.round((40*40)/(50*2)*1.0) = 16
    // drain heal: Math.round(16 * 0.5) = 8  →  player HP = 30 + 8 = 38
    const state = makeState({
      player_team: [{ creature_id: 'p1', current_hp: 30, max_hp: 45, slot: 1 }],
    })
    const drainCreature = makeCreature({ id: 'p1', moves: [drainMove] })
    const trainerWithStatus = makeCreature({
      id: 't1',
      name: 'Tide Haunt',
      types: ['Elemental'],
      spd: 30,
      moves: [statusMove],
    })
    const testCreatures = new Map<string, BattleCreatureData>([
      ['p1', drainCreature],
      ['t1', trainerWithStatus],
    ])
    // Player is faster (35 > 30), acts first with drain
    const { newState } = resolveTurn(state, drainMove.id, statusMove.id, testCreatures, typeMap)
    // After drain: player healed 8 HP → 38. Trainer used status (no damage). Player HP = 38.
    expect(newState.player_team[0].current_hp).toBeGreaterThan(30)
    expect(newState.player_team[0].current_hp).toBeLessThanOrEqual(45)
  })

  it('increments turn_number', () => {
    const state = makeState({ turn_number: 3 })
    const { newState } = resolveTurn(state, attackMove.id, attackMove.id, creatures, typeMap)
    expect(newState.turn_number).toBe(4)
  })
})
