import { createClient } from '@/lib/supabase/server'
import type { Creature, CreatureWithMoves, Move } from '@/lib/types'

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
