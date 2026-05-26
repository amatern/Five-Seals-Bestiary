'use client'

import { useState } from 'react'
import { StepConcept } from '@/components/forge/StepConcept'
import { StepDraft } from '@/components/forge/StepDraft'
import { StepArtwork } from '@/components/forge/StepArtwork'
import { StepVault } from '@/components/forge/StepVault'
import type { Move } from '@/lib/types'
import type { ForgeDraft } from '@/lib/forge/types'

interface ForgeWizardProps {
  moves: Move[]
}

type ForgeStep = 1 | 2 | 3 | 4

export function ForgeWizard({ moves }: ForgeWizardProps) {
  const [step, setStep] = useState<ForgeStep>(1)
  const [concept, setConcept] = useState('')
  const [draft, setDraft] = useState<ForgeDraft | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [submittedToBestiary, setSubmittedToBestiary] = useState(false)

  async function handleGenerate(conceptText: string, hintTypes: string[], hintRegion: string) {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/forge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: conceptText,
          hint_types: hintTypes,
          hint_region: hintRegion,
        }),
      })
      if (!res.ok) throw new Error('generation-failed')
      const data: ForgeDraft = await res.json()
      setConcept(conceptText)
      setDraft(data)
      setStep(2)
    } catch {
      setError('The Forge did not answer. Try again when the flame is steadier.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave(submitToBestiary: boolean) {
    if (!draft) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/forge/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, artwork_url: artworkUrl }),
      })
      if (!res.ok) throw new Error('save-failed')
      const { id } = await res.json()
      setSavedId(id)
      setSubmittedToBestiary(submitToBestiary)
    } catch {
      setError('The chronicler could not record this. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (savedId) {
    return (
      <main className="min-h-screen bg-stone-950 p-8">
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
          <p className="text-stone-300 text-xl mb-3">The chronicler has recorded it.</p>
          <p className="text-stone-600 text-sm italic mb-10">
            {submittedToBestiary
              ? "It awaits the chronicler's approval before appearing in the shared Bestiary."
              : 'Saved to your vault.'}
          </p>
          <div className="flex gap-6">
            <a
              href="/forge"
              className="text-stone-500 text-sm hover:text-stone-300 transition-colors"
            >
              Forge another
            </a>
            <a
              href="/bestiary"
              className="text-stone-300 text-sm hover:text-stone-100 transition-colors"
            >
              Return to the Bestiary →
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-2xl mx-auto">
        <a
          href="/bestiary"
          className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block"
        >
          ← The Bestiary
        </a>

        <h1 className="text-stone-100 text-3xl font-semibold mb-1">The Forge</h1>
        <p className="text-stone-600 text-sm italic mb-6">
          Speak its nature into the flame. The Chronicler will record what emerges.
        </p>

        {/* Step progress bars */}
        <div className="flex gap-1.5 mb-8">
          {([1, 2, 3, 4] as ForgeStep[]).map(n => (
            <div
              key={n}
              className={`h-0.5 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-stone-400' : 'bg-stone-800'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm italic mb-6">{error}</p>
        )}

        {step === 1 && (
          <StepConcept onGenerate={handleGenerate} isLoading={isLoading} />
        )}
        {step === 2 && draft && (
          <StepDraft
            draft={draft}
            moves={moves}
            onUpdate={setDraft}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepArtwork
            concept={concept}
            artworkUrl={artworkUrl}
            onArtwork={setArtworkUrl}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && draft && (
          <StepVault
            draft={draft}
            artworkUrl={artworkUrl}
            onSave={handleSave}
            onBack={() => setStep(3)}
            isLoading={isLoading}
          />
        )}
      </div>
    </main>
  )
}
