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
