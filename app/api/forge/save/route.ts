import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: {
    name?: string
    types?: string[]
    flavor_text?: string
    hp?: number
    atk?: number
    def?: number
    spd?: number
    move_ids?: string[]
    artwork_url?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, types, flavor_text, hp, atk, def, spd, move_ids = [], artwork_url } = body

  // Validate required fields
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!types?.length) {
    return NextResponse.json({ error: 'types is required' }, { status: 400 })
  }
  if (!flavor_text?.trim()) {
    return NextResponse.json({ error: 'flavor_text is required' }, { status: 400 })
  }
  if (!hp || !atk || !def || !spd) {
    return NextResponse.json({ error: 'stats are required' }, { status: 400 })
  }
  if (move_ids.length !== 4) {
    return NextResponse.json({ error: 'Exactly 4 moves required' }, { status: 400 })
  }

  // Insert creature
  const { data: creature, error: creatureError } = await supabase
    .from('creatures')
    .insert({
      name: name.trim(),
      types,
      flavor_text: flavor_text.trim(),
      hp,
      atk,
      def,
      spd,
      origin: 'player-designed',
      creator_id: user.id,
      artwork_url: artwork_url ?? null,
      approved: false,
    })
    .select('id')
    .single()

  if (creatureError) {
    console.error('[forge/save] Insert creature failed:', creatureError)
    return NextResponse.json({ error: 'save-failed' }, { status: 500 })
  }

  // Insert creature_moves (all 4 in one call)
  const movesRows = move_ids.map((move_id, i) => ({
    creature_id: creature.id,
    move_id,
    slot: i + 1,
  }))

  const { error: movesError } = await supabase.from('creature_moves').insert(movesRows)
  if (movesError) {
    console.error('[forge/save] Insert creature_moves failed:', movesError)
    // Clean up the orphaned creature
    await supabase.from('creatures').delete().eq('id', creature.id)
    return NextResponse.json({ error: 'save-failed' }, { status: 500 })
  }

  return NextResponse.json({ id: creature.id })
}
