import { describe, it, expect } from 'vitest'

const hasSupabaseEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!hasSupabaseEnv)('Supabase environment variables', () => {
  it('has NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\//)
  })

  it('has NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length).toBeGreaterThan(20)
  })
})
