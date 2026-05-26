import { describe, it, expect, vi, beforeEach } from 'vitest'

const TRAINER_ID = '00000000-0000-0000-0000-aaaaaaaaaaaa'
const CREATURE_1 = '00000000-0000-0000-0000-bbbbbbbbbb01'
const CREATURE_2 = '00000000-0000-0000-0000-bbbbbbbbbb02'
const BATTLE_ID  = '00000000-0000-0000-0000-cccccccccccc'
const USER_ID    = 'user-1'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

function makeSupabase({
  user = { id: USER_ID } as { id: string } | null,
  trainerData = { id: TRAINER_ID } as unknown,
  trainerError = null as unknown,
  playerCreaturesData = [
    { id: CREATURE_1, creator_id: USER_ID, hp: 45, atk: 40, def: 50, spd: 35, types: ['Undead'], creature_moves: [] },
  ] as unknown[],
  trainerCreaturesData = [
    { creature_id: 'tc-1', slot: 1, creature: { id: 'tc-1', hp: 70, atk: 60, def: 55, spd: 50, creature_moves: [] } },
  ] as unknown[],
  battleInsertData = { id: BATTLE_ID } as unknown,
  battleInsertError = null as unknown,
  teamsInsertError = null as unknown,
} = {}) {
  // trainer lookup
  const trainerSingle = vi.fn().mockResolvedValue({ data: trainerData, error: trainerError })
  const trainerEq = vi.fn().mockReturnValue({ single: trainerSingle })
  const trainerSelect = vi.fn().mockReturnValue({ eq: trainerEq })

  // player creatures lookup (using .in())
  const creaturesIn = vi.fn().mockResolvedValue({ data: playerCreaturesData, error: null })
  const creaturesSelect = vi.fn().mockReturnValue({ in: creaturesIn })

  // trainer creatures lookup
  const tcOrder = vi.fn().mockResolvedValue({ data: trainerCreaturesData, error: null })
  const tcEq = vi.fn().mockReturnValue({ order: tcOrder })
  const tcSelect = vi.fn().mockReturnValue({ eq: tcEq })

  // battles insert
  const battleSingle = vi.fn().mockResolvedValue({ data: battleInsertData, error: battleInsertError })
  const battleSelect = vi.fn().mockReturnValue({ single: battleSingle })
  const battleInsert = vi.fn().mockReturnValue({ select: battleSelect })

  // battle_teams insert
  const teamsInsert = vi.fn().mockResolvedValue({ error: teamsInsertError })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trainers') return { select: trainerSelect }
      if (table === 'trainer_creatures') return { select: tcSelect }
      if (table === 'creatures') return { select: creaturesSelect }
      if (table === 'battles') return { insert: battleInsert }
      if (table === 'battle_teams') return { insert: teamsInsert }
      return {}
    }),
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/battle/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/battle/create', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as any)
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ user: null }) as any)
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [CREATURE_1] }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when trainer_id is missing', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ creature_slots: [CREATURE_1] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when creature_slots is empty', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when creature_slots has more than 6', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: ['a','b','c','d','e','f','g'] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when duplicate creature IDs', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [CREATURE_1, CREATURE_1] }) as any)
    expect(res.status).toBe(400)
  })

  it('returns 200 with battle id on success', async () => {
    const { POST } = await import('@/app/api/battle/create/route')
    const res = await POST(makeRequest({ trainer_id: TRAINER_ID, creature_slots: [CREATURE_1] }) as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(BATTLE_ID)
  })
})
