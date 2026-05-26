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

  // Load player's creatures (validates existence and ownership via creator_id)
  const { data: playerCreatures, error: pcError } = await supabase
    .from('creatures')
    .select('id, hp, atk, def, spd, types, creator_id, creature_moves(slot, move_id)')
    .in('id', creature_slots)

  if (pcError || !playerCreatures) {
    return NextResponse.json({ error: 'Failed to load creatures' }, { status: 500 })
  }

  // Verify all creatures belong to this player
  const notOwned = (playerCreatures as any[]).filter((c: any) => c.creator_id !== user.id)
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
    const c = (playerCreatures as any[]).find((p: any) => p.id === cid)!
    return { creature_id: cid, current_hp: c.hp, max_hp: c.hp, slot: i + 1 }
  })

  const trainerTeam: BattleCreature[] = (trainerCreatures as any[]).map((tc: any) => ({
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
    battle_id: (battle as any).id,
    user_id: user.id,
    creature_id: cid,
    slot: i + 1,
  }))

  const { error: teamsError } = await supabase.from('battle_teams').insert(teamRows)
  if (teamsError) {
    console.error('[battle/create] Teams insert failed:', teamsError)
    return NextResponse.json({ error: 'create-failed' }, { status: 500 })
  }

  return NextResponse.json({ id: (battle as any).id })
}
