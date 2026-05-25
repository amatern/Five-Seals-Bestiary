export type MoveType = 'attack' | 'status'
export type StatusEffect = 'atk_down' | 'def_up' | 'spd_down' | 'drain'
export type Origin = 'canon' | 'player-designed' | 'admin-designed'
export type CreatureType =
  | 'Fiendish' | 'Elemental' | 'Undead' | 'Celestial'
  | 'Aberration' | 'Arcane' | 'Fey' | 'Beast'

export interface Move {
  id: string
  name: string
  type: string
  power: number | null
  move_type: MoveType
  status_effect: StatusEffect | null
  description: string
}

export interface CreatureMove {
  slot: number
  move: Move
}

export interface Creature {
  id: string
  name: string
  types: string[]
  flavor_text: string
  hp: number
  atk: number
  def: number
  spd: number
  origin: Origin
  creator_id: string | null
  artwork_url: string | null
  approved: boolean
  gate_key: string | null
  created_at: string
}

export interface CreatureWithMoves extends Creature {
  creature_moves: CreatureMove[]
}
