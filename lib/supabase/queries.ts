import { createClient } from '@/lib/supabase/server'
import type { Creature, CreatureWithMoves, Move } from '@/lib/types'
import type { Trainer, BattleState } from '@/lib/battle/types'

export async function getApprovedCreatures(filters?: {
  type?: string
  gate_key?: string
}): Promise<Creature[]> {
  const supabase = await createClient()
  let query = supabase
    .from('creatures')
    .select('*')
    .eq('approved', true)
    .order('name')

  if (filters?.type) {
    // PostgreSQL array contains operator — matches if types array includes the specified type
    query = query.contains('types', [filters.type])
  }
  if (filters?.gate_key) {
    query = query.eq('gate_key', filters.gate_key)
  }

  const { data, error } = await query
  if (error) throw new Error(`getApprovedCreatures: ${error.message}`)
  return (data ?? []) as Creature[]
}

export async function getCreatureWithMoves(id: string): Promise<CreatureWithMoves | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creatures')
    .select(`
      *,
      creature_moves (
        slot,
        move:moves (*)
      )
    `)
    .eq('id', id)
    .eq('approved', true)
    .order('slot', { referencedTable: 'creature_moves' })
    .single()

  if (error) return null
  if (!data || !Array.isArray(data.creature_moves)) {
    return null
  }
  return data as CreatureWithMoves
}

export async function getMoves(): Promise<Move[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('moves')
    .select('*')
    .order('type')
    .order('name')
  if (error) throw new Error(`getMoves: ${error.message}`)
  return (data ?? []) as Move[]
}

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
  battle_state: BattleState | null
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
