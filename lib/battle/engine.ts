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
  // Game design: only the first type is used for effectiveness calculation.
  // Multi-type creatures like [Elemental, Aberration] are checked against their primary type only.
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
  let s: BattleState = JSON.parse(JSON.stringify(state))

  const playerCreatureId = s.player_team[s.player_active_slot].creature_id
  const trainerCreatureId = s.trainer_team[s.trainer_active_slot].creature_id

  const playerData = creatures.get(playerCreatureId)!
  const trainerData = creatures.get(trainerCreatureId)!

  const playerMove = playerData.moves.find(m => m.id === playerMoveId)!
  const trainerMove = trainerData.moves.find(m => m.id === aiMoveId)!

  const effectivePlayerSpd = applyEffectToStat(playerData.spd, 'spd', s.player_effects)
  const effectiveTrainerSpd = applyEffectToStat(trainerData.spd, 'spd', s.trainer_effects)

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
    // Second mover didn't get to act
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
