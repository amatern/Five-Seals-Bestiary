import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CreatureCard } from '@/components/CreatureCard'
import type { Creature } from '@/lib/types'

// next/link renders as <a> in jsdom but needs router context — mock it
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const mockCreature: Creature = {
  id: '00000000-0000-0000-0000-000000000112',
  name: 'Dragonclaw',
  types: ['Beast', 'Fiendish'],
  flavor_text: 'They were farmers, last year. The dreams came, and they understood.',
  hp: 45, atk: 45, def: 40, spd: 50,
  origin: 'canon',
  creator_id: null,
  artwork_url: null,
  approved: true,
  gate_key: 'always',
  created_at: '2026-05-24T00:00:00Z',
}

describe('CreatureCard', () => {
  it('renders the creature name', () => {
    render(<CreatureCard creature={mockCreature} />)
    expect(screen.getByText('Dragonclaw')).toBeInTheDocument()
  })

  it('renders all type badges', () => {
    render(<CreatureCard creature={mockCreature} />)
    expect(screen.getByText('Beast')).toBeInTheDocument()
    expect(screen.getByText('Fiendish')).toBeInTheDocument()
  })

  it('shows canon sigil for canon creatures', () => {
    render(<CreatureCard creature={mockCreature} />)
    expect(screen.getByText('✦')).toBeInTheDocument()
  })

  it('does not show canon sigil for player-designed creatures', () => {
    render(<CreatureCard creature={{ ...mockCreature, origin: 'player-designed' }} />)
    expect(screen.queryByText('✦')).not.toBeInTheDocument()
  })

  it('renders all four stat labels', () => {
    render(<CreatureCard creature={mockCreature} />)
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('ATK')).toBeInTheDocument()
    expect(screen.getByText('DEF')).toBeInTheDocument()
    expect(screen.getByText('SPD')).toBeInTheDocument()
  })

  it('links to /bestiary/[id]', () => {
    render(<CreatureCard creature={mockCreature} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/bestiary/${mockCreature.id}`)
  })

  it('renders flavor text', () => {
    render(<CreatureCard creature={mockCreature} />)
    expect(screen.getByText(/They were farmers/)).toBeInTheDocument()
  })
})
