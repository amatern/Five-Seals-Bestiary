import { createClient } from '@/lib/supabase/server'
import type { Creature, CreatureWithMoves } from '@/lib/types'

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
  return data as CreatureWithMoves
}
