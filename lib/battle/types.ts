import type { Move } from '@/lib/types'

export interface BattleCreature {
  creature_id: string
  current_hp: number
  max_hp: number
  slot: number  // 1-indexed, matches battle_teams.slot
}

export interface ActiveEffect {
  // drain is not stored as an ongoing effect — it is resolved immediately as damage+heal
  effect: 'atk_down' | 'def_up' | 'spd_down'
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
