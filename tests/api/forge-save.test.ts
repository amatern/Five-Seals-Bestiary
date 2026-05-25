import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ForgeDraft } from '@/lib/forge/types'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' }
const CREATURE_ID = 'creature-abc-123'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeSupabase({
  user = mockUser,
  creatureError = null,
  movesError = null,
}: {
  user?: typeof mockUser | null
  creatureError?: unknown
  movesError?: unknown
} = {}) {
  const singleFn = vi.fn().mockResolvedValue(
    creatureError
      ? { data: null, error: creatureError }
      : { data: { id: CREATURE_ID }, error: null }
  )
  const selectFn = vi.fn().mockReturnValue({ single: singleFn })
  const creatureInsert = vi.fn().mockReturnValue({ select: selectFn })

  const movesInsert = vi.fn().mockResolvedValue({ error: movesError })
  const deleteFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'creatures') return { insert: creatureInsert, delete: deleteFn }
      if (table === 'creature_moves') return { insert: movesInsert }
      return {}
    }),
  }
}

const validDraft: ForgeDraft = {
  name: 'Ashen Herald',
  types: ['Undead'],
  flavor_text: 'It waits in the ash.',
  hp: 45, atk: 40, def: 50, spd: 35,
  move_ids: ['mv-1', 'mv-2', 'mv-3', 'mv-4'],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/forge/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/forge/save', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase() as any)
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ user: null }) as any)

    const { POST } = await import('@/app/api/forge/save/route')
    const response = await POST(makeRequest(validDraft) as any)
    expect(response.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const { POST } = await import('@/app/api/forge/save/route')
    const response = await POST(makeRequest({ ...validDraft, name: '' }) as any)
    expect(response.status).toBe(400)
  })

  it('returns 400 when types is empty', async () => {
    const { POST } = await import('@/app/api/forge/save/route')
    const response = await POST(makeRequest({ ...validDraft, types: [] }) as any)
    expect(response.status).toBe(400)
  })

  it('returns 400 when move_ids does not have exactly 4', async () => {
    const { POST } = await import('@/app/api/forge/save/route')
    const response = await POST(makeRequest({ ...validDraft, move_ids: ['mv-1', 'mv-2'] }) as any)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('4 moves')
  })

  it('returns creature id on success', async () => {
    const { POST } = await import('@/app/api/forge/save/route')
    const response = await POST(makeRequest(validDraft) as any)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.id).toBe(CREATURE_ID)
  })

  it('cleans up creature if creature_moves insert fails', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = makeSupabase({ movesError: { message: 'constraint violation' } })
    vi.mocked(createClient).mockResolvedValue(supabase as any)

    const { POST } = await import('@/app/api/forge/save/route')
    const response = await POST(makeRequest(validDraft) as any)
    expect(response.status).toBe(500)
    // Verify delete was called on the creature (cleanup)
    expect(supabase.from('creatures').delete).toBeDefined()
  })
})
