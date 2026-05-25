import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' }
const FAKE_OPENAI_URL = 'https://oaidalleapiprodscus.blob.core.windows.net/fake/image.png'
const FAKE_PUBLIC_URL = 'https://sdutnggfomffbpbnoobf.supabase.co/storage/v1/object/public/artwork/user-1/123.png'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const mockGenerate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function() {
    return { images: { generate: mockGenerate } }
  }),
}))

// Mock global fetch for the OpenAI image download
global.fetch = vi.fn().mockResolvedValue({
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
} as any)

function makeAuthenticatedSupabase(uploadError: unknown = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: {}, error: uploadError }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: FAKE_PUBLIC_URL } }),
      }),
    },
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/forge/artwork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/forge/artwork', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeAuthenticatedSupabase() as any)

    mockGenerate.mockResolvedValue({
      data: [{ url: FAKE_OPENAI_URL }],
    })
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any)

    const { POST } = await import('@/app/api/forge/artwork/route')
    const response = await POST(makeRequest({ concept: 'A dragon' }) as any)
    expect(response.status).toBe(401)
  })

  it('returns 400 when concept is missing', async () => {
    const { POST } = await import('@/app/api/forge/artwork/route')
    const response = await POST(makeRequest({}) as any)
    expect(response.status).toBe(400)
  })

  it('returns a URL on success', async () => {
    const { POST } = await import('@/app/api/forge/artwork/route')
    const response = await POST(makeRequest({ concept: 'A bone guardian' }) as any)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.url).toBe(FAKE_PUBLIC_URL)
  })
})

describe('POST /api/forge/upload', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeAuthenticatedSupabase() as any)
  })

  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any)

    const formData = new FormData()
    formData.append('file', new File(['data'], 'img.png', { type: 'image/png' }))
    const request = new Request('http://localhost/api/forge/upload', {
      method: 'POST',
      body: formData,
    })

    const { POST } = await import('@/app/api/forge/upload/route')
    const response = await POST(request as any)
    expect(response.status).toBe(401)
  })

  it('returns 400 when no file is provided', async () => {
    const formData = new FormData()
    const request = new Request('http://localhost/api/forge/upload', {
      method: 'POST',
      body: formData,
    })
    const { POST } = await import('@/app/api/forge/upload/route')
    const response = await POST(request as any)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('No file')
  })

  it('returns 400 for invalid file type', async () => {
    const formData = new FormData()
    formData.append('file', new File(['data'], 'img.gif', { type: 'image/gif' }))
    const request = new Request('http://localhost/api/forge/upload', {
      method: 'POST',
      body: formData,
    })
    const { POST } = await import('@/app/api/forge/upload/route')
    const response = await POST(request as any)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid file type')
  })

  it('returns a URL on successful upload', async () => {
    const formData = new FormData()
    formData.append('file', new File(['data'], 'img.png', { type: 'image/png' }))
    const request = new Request('http://localhost/api/forge/upload', {
      method: 'POST',
      body: formData,
    })
    const { POST } = await import('@/app/api/forge/upload/route')
    const response = await POST(request as any)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.url).toBe(FAKE_PUBLIC_URL)
  })
})
