import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepConcept } from '@/components/forge/StepConcept'

describe('StepConcept', () => {
  it('renders the concept textarea', () => {
    render(<StepConcept onGenerate={vi.fn()} isLoading={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('disables the submit button when concept is empty', () => {
    render(<StepConcept onGenerate={vi.fn()} isLoading={false} />)
    const button = screen.getByRole('button', { name: /Summon the Forge/i })
    expect(button).toBeDisabled()
  })

  it('enables the submit button when concept has text', () => {
    render(<StepConcept onGenerate={vi.fn()} isLoading={false} />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A guardian of the deep' },
    })
    expect(screen.getByRole('button', { name: /Summon the Forge/i })).not.toBeDisabled()
  })

  it('shows loading text when isLoading is true', () => {
    render(<StepConcept onGenerate={vi.fn()} isLoading={true} />)
    expect(screen.getByText('The Forge burns...')).toBeInTheDocument()
  })

  it('toggles a type hint chip on click', () => {
    render(<StepConcept onGenerate={vi.fn()} isLoading={false} />)
    const fiendishBtn = screen.getByRole('button', { name: 'Fiendish' })
    expect(fiendishBtn).not.toHaveClass('bg-stone-200')
    fireEvent.click(fiendishBtn)
    expect(fiendishBtn).toHaveClass('bg-stone-200')
    fireEvent.click(fiendishBtn)
    expect(fiendishBtn).not.toHaveClass('bg-stone-200')
  })

  it('calls onGenerate with concept and selected hints when submitted', () => {
    const onGenerate = vi.fn()
    render(<StepConcept onGenerate={onGenerate} isLoading={false} />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A bone wyrm' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Undead' }))
    fireEvent.click(screen.getByRole('button', { name: /Summon the Forge/i }))
    expect(onGenerate).toHaveBeenCalledWith('A bone wyrm', ['Undead'], '')
  })
})
