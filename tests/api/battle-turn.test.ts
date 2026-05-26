import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BattleState } from '@/lib/battle/types'

const USER_ID    = 'user-1'
const BATTLE_ID  = 'battle-abc'
const MOVE_ID    = '00000000-0000-0000-0000-000000000015'  // Hollow Gaze (atk_down, status)
const CREATURE_1 = '00000000-0000-0000-0000-000000000115'  // Ash Wraith

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const baseState: BattleState = {
  player_team: [{ creature_id: CREATURE_1, current_hp: 45, max_hp: 45, slot: 1 }],
  player_active_slot: 0,
  player_effects: [],
  trainer_team: [{ creature_id: '00000000-0000-0000-0000-000000000116', current_hp: 75, max_hp: 75, slot: 1 }],
  trainer_active_slot: 0,
  trainer_effects: [],
  turn_number: 1,
}

function makeSupabase({
  user = { id: USER_ID } as { id: string } | null,
  battle = {
    id: BATTLE_ID,
    challenger_id: USER_ID,
    status: 'active',
    trainer_id: 'trainer-1',
    battle_state: baseState,
    trainer: { id: 'trainer-1', name: 'Thessalmar\'s Vessel', ai_behavior: 'aggressive' },
  } as unknown,
  battleError = null as unknown,
} = {}) {
  const singleBattle = vi.fn().mockResolvedValue({ data: battle, error: battleError })
  const battleSelectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single: singleBattle }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }

  const creaturesSelectResult = vi.fn().mockResolvedValue({
    data: [
      {
        id: CREATURE_1,
        name: 'Ash Wraith', types: ['Undead', 'Elemental'],
        hp: 45, atk: 60, def: 45, spd: 70,
        creature_moves: [
          { slot: 1, move: { id: MOVE_ID, name: 'Hollow Gaze', type: 'Undead', power: null, move_type: 'status', status_effect: 'atk_down', description: 'x' } },
          { slot: 2, move: { id: '00000000-0000-0000-0000-000000000034', name: 'Ashen Touch', type: 'Elemental', power: 50, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 3, move: { id: '00000000-0000-0000-0000-000000000035', name: 'Smoldering Wail', type: 'Undead', power: 60, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 4, move: { id: '00000000-0000-0000-0000-000000000036', name: 'Cinder Cloak', type: 'Elemental', power: null, move_type: 'status', status_effect: 'def_up', description: 'x' } },
        ],
      },
      {
        id: '00000000-0000-0000-0000-000000000116',
        name: 'Drowned Reliquary', types: ['Aberration', 'Elemental'],
        hp: 75, atk: 65, def: 60, spd: 40,
        creature_moves: [
          { slot: 1, move: { id: '00000000-0000-0000-0000-000000000037', name: 'Names of the Drowned', type: 'Aberration', power: 65, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 2, move: { id: '00000000-0000-0000-0000-000000000038', name: 'Brackish Embrace', type: 'Aberration', power: 70, move_type: 'attack', status_effect: null, description: 'x' } },
          { slot: 3, move: { id: '00000000-0000-0000-0000-000000000039', name: "Reliquary's Curse", type: 'Aberration', power: null, move_type: 'status', status_effect: 'spd_down', description: 'x' } },
          { slot: 4, move: { id: '00000000-0000-0000-0000-000000000005', name: 'Drowning Tide', type: 'Elemental', power: 75, move_type: 'attack', status_effect: null, description: 'x' } },
        ],
      },
    ],
    error: null,
  })

  const typeEffSelectResult = vi.fn().mockResolvedValue({
    data: [
      { attacking_type: 'Undead', defending_type: 'Elemental', modifier: 0.5 },
      { attacking_type: 'Elemental', defending_type: 'Undead', modifier: 2.0 },
      { attacking_type: 'Aberration', defending_type: 'Undead', modifier: 0.5 },
    ],
    error: null,
  })

  const turnsInsert = vi.fn().mockResolvedValue({ error: null })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'battles') return battleSelectChain
      if (table === 'creatures') return { select: vi.fn().mockReturnValue({ in: creaturesSelectResult }) }
      if (table === 'type_effectiveness') return { select: typeEffSelectResult }
      if (table === 'battle_turns') return { insert: turnsInsert }
      return {}
    }),
  }
}

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  }
}

describe('POST /api/battle/[id]/turn', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as any)
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ user: null }) as any)
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when battle not found', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ battle: null, battleError: { message: 'not found' } }) as any)
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(404)
  })

  it('returns 400 when battle is already complete', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({
      battle: { id: BATTLE_ID, challenger_id: USER_ID, status: 'complete', trainer_id: 'trainer-1', battle_state: baseState, trainer: { id: 'trainer-1', name: 'Test', ai_behavior: 'aggressive' } },
    }) as any)
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when move_id is not in active creature moves', async () => {
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: 'invalid-move-id' }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(400)
  })

  it('returns 200 with state, playerTurn, aiTurn on success', async () => {
    const { POST } = await import('@/app/api/battle/[id]/turn/route')
    const res = await POST(makeRequest({ move_id: MOVE_ID }) as any, { params: Promise.resolve({ id: BATTLE_ID }) } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBeDefined()
    expect(body.playerTurn).toBeDefined()
    expect(body.aiTurn).toBeDefined()
    expect(typeof body.battleOver).toBe('boolean')
  })
})
