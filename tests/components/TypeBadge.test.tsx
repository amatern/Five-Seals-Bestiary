import { render, screen } from '@testing-library/react'
import { TypeBadge } from '@/components/TypeBadge'

describe('TypeBadge', () => {
  it('renders the type name', () => {
    render(<TypeBadge type="Fiendish" />)
    expect(screen.getByText('Fiendish')).toBeInTheDocument()
  })

  it('applies Fiendish color class', () => {
    const { container } = render(<TypeBadge type="Fiendish" />)
    expect(container.firstChild).toHaveClass('bg-red-950')
  })

  it('applies fallback style for unknown type', () => {
    const { container } = render(<TypeBadge type="Unknown" />)
    expect(container.firstChild).toHaveClass('bg-stone-900')
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('uses smaller padding for sm size', () => {
    const { container } = render(<TypeBadge type="Fey" size="sm" />)
    expect(container.firstChild).toHaveClass('px-1.5')
  })

  it('uses default padding for md size', () => {
    const { container } = render(<TypeBadge type="Fey" />)
    expect(container.firstChild).toHaveClass('px-2')
  })
})
