import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Move } from '@/lib/types'

// ── Mocks (hoisted before imports) ─────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' }

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/queries', () => ({
  getMoves: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn(),
      },
    }
  }),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockMoves: Move[] = [
  { id: 'mv-1', name: 'Bone Hymn',    type: 'Undead',   move_type: 'attack', power: 45, status_effect: null,       description: 'd' },
  { id: 'mv-2', name: 'Hollow Gaze',  type: 'Undead',   move_type: 'status', power: null, status_effect: 'atk_down', description: 'd' },
  { id: 'mv-3', name: 'Twilight Veil',type: 'Arcane',   move_type: 'status', power: null, status_effect: 'def_up',  description: 'd' },
  { id: 'mv-4', name: 'Crimson Bite', type: 'Fiendish', move_type: 'attack', power: 55, status_effect: null,       description: 'd' },
]

const mockClaudeInput = {
  name: 'Ashen Herald',
  types: ['Undead', 'Arcane'],
  flavor_text: 'It speaks only in the voices of those it has unmade.',
  hp: 45, atk: 40, def: 50, spd: 35,
  move_names: ['Bone Hymn', 'Hollow Gaze', 'Twilight Veil', 'Crimson Bite'],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/forge/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/forge/generate', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Default: authenticated user
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as any)

    // Default: getMoves returns mock moves
    const { getMoves } = await import('@/lib/supabase/queries')
    vi.mocked(getMoves).mockResolvedValue(mockMoves)

    // Default: Claude returns a valid creature
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', name: 'create_creature', input: mockClaudeInput }],
    })
    vi.mocked(Anthropic).mockImplementation(function () {
      return { messages: { create: mockCreate } } as any
    })
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    const { POST } = await import('@/app/api/forge/generate/route')
    const response = await POST(makeRequest({ concept: 'A test creature' }) as any)
    expect(response.status).toBe(401)
  })

  it('returns 400 when concept is missing', async () => {
    const { POST } = await import('@/app/api/forge/generate/route')
    const response = await POST(makeRequest({}) as any)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('concept')
  })

  it('returns 400 when concept is empty string', async () => {
    const { POST } = await import('@/app/api/forge/generate/route')
    const response = await POST(makeRequest({ concept: '   ' }) as any)
    expect(response.status).toBe(400)
  })

  it('returns a valid draft on success', async () => {
    const { POST } = await import('@/app/api/forge/generate/route')
    const response = await POST(makeRequest({ concept: 'A guardian of the deep' }) as any)
    expect(response.status).toBe(200)

    const draft = await response.json()
    expect(draft.name).toBe('Ashen Herald')
    expect(draft.types).toEqual(['Undead', 'Arcane'])
    expect(draft.flavor_text).toBeTruthy()
    expect(draft.hp).toBeGreaterThanOrEqual(25)
    expect(draft.hp).toBeLessThanOrEqual(80)
    expect(draft.move_ids).toHaveLength(4)
    expect(draft.move_ids[0]).toBe('mv-1') // Bone Hymn
  })

  it('clamps stats to 25–80 range', async () => {
    const { getMoves } = await import('@/lib/supabase/queries')
    vi.mocked(getMoves).mockResolvedValue(mockMoves)

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', name: 'create_creature', input: {
        ...mockClaudeInput, hp: 200, atk: 5, def: 0, spd: 99
      }}],
    })
    vi.mocked(Anthropic).mockImplementation(function () {
      return { messages: { create: mockCreate } } as any
    })

    const { POST } = await import('@/app/api/forge/generate/route')
    const response = await POST(makeRequest({ concept: 'test' }) as any)
    const draft = await response.json()
    expect(draft.hp).toBe(80)
    expect(draft.atk).toBe(25)
    expect(draft.def).toBe(25)
    expect(draft.spd).toBe(80)
  })
})
