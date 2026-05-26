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

  // Load battle with trainer
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

  // Build chronicle text for each turn
  function fillChronicle(
    turn: typeof playerTurn,
    move: Move,
    attackerName: string,
    targetName: string,
  ): string {
    const faintedName = turn.fainted
      ? (turn.actor === 'player' ? trainerCreatureData.name : playerCreatureData.name)
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

  playerTurn.chronicle_text = fillChronicle(
    playerTurn,
    playerMove,
    playerCreatureData.name,
    trainerCreatureData.name,
  )
  aiTurn.chronicle_text = fillChronicle(
    aiTurn,
    aiMove,
    trainerCreatureData.name,
    playerCreatureData.name,
  )

  // Insert two battle_turns rows
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

  // End-of-battle chronicle
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
