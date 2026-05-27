'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Creature } from '@/lib/types'
import type { Trainer } from '@/lib/battle/types'

interface Props {
  trainer: Trainer
  ownedCreatures: Creature[]  // only approved creatures
  onCancel: () => void
}

export function TeamSelector({ trainer, ownedCreatures, onCancel }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 6 ? [...prev, id] : prev
    )
  }

  async function handleStart() {
    if (selected.length === 0) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/battle/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: trainer.id, creature_slots: selected }),
      })
      if (!res.ok) throw new Error('create-failed')
      const { id } = await res.json()
      router.push(`/battle/${id}`)
    } catch {
      setError('Could not begin the battle. Try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-stone-950/90 flex items-center justify-center z-50 p-6">
      <div className="bg-stone-900 border border-stone-700 rounded-xl max-w-lg w-full p-6">
        <h2 className="text-stone-100 text-lg font-semibold mb-1">Challenge {trainer.name}</h2>
        <p className="text-stone-600 text-xs italic mb-1">{trainer.intro_text}</p>
        <p className="text-stone-500 text-xs mb-4">Select 1–6 creatures for your team.</p>

        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto mb-4">
          {ownedCreatures.map(c => {
            const isSelected = selected.includes(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-stone-400 bg-stone-800'
                    : 'border-stone-700 bg-stone-900 hover:border-stone-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-stone-200 text-sm font-medium">{c.name}</span>
                  <div className="flex gap-1">
                    {c.types.map(t => (
                      <span key={t} className="text-xs bg-stone-700 text-stone-400 px-1.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1 text-center text-xs text-stone-600">
                  <div>HP {c.hp}</div>
                  <div>ATK {c.atk}</div>
                  <div>DEF {c.def}</div>
                  <div>SPD {c.spd}</div>
                </div>
              </button>
            )
          })}
        </div>

        {error && <p className="text-red-400 text-xs italic mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-stone-700 text-stone-500 rounded py-2 text-sm hover:text-stone-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={selected.length === 0 || isLoading}
            className="flex-1 bg-stone-100 text-stone-950 rounded py-2 text-sm font-semibold disabled:opacity-40 hover:bg-stone-200 transition-colors"
          >
            {isLoading ? 'Preparing…' : `Enter the battle (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
