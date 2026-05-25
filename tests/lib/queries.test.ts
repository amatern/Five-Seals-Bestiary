import { describe, it, expect } from 'vitest'
import { getApprovedCreatures, getCreatureWithMoves } from '@/lib/supabase/queries'

describe('query exports', () => {
  it('exports getApprovedCreatures as a function', () => {
    expect(typeof getApprovedCreatures).toBe('function')
  })

  it('exports getCreatureWithMoves as a function', () => {
    expect(typeof getCreatureWithMoves).toBe('function')
  })
})
