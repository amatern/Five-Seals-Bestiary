'use client'

import { TypeBadge } from '@/components/TypeBadge'
import type { Move } from '@/lib/types'
import type { ForgeDraft } from '@/lib/forge/types'

const TYPES = ['Fiendish', 'Elemental', 'Undead', 'Celestial', 'Aberration', 'Arcane', 'Fey', 'Beast']

interface StepDraftProps {
  draft: ForgeDraft
  moves: Move[]
  onUpdate: (draft: ForgeDraft) => void
  onNext: () => void
  onBack: () => void
}

export function StepDraft({ draft, moves, onUpdate, onNext, onBack }: StepDraftProps) {
  function update<K extends keyof ForgeDraft>(key: K, value: ForgeDraft[K]) {
    onUpdate({ ...draft, [key]: value })
  }

  function toggleType(type: string) {
    if (draft.types.includes(type)) {
      update('types', draft.types.filter(t => t !== type))
    } else if (draft.types.length < 2) {
      update('types', [...draft.types, type])
    }
  }

  function setMoveSlot(slot: number, moveId: string) {
    const ids = [...draft.move_ids]
    ids[slot] = moveId
    update('move_ids', ids)
  }

  const filledMoveIds = draft.move_ids.filter(Boolean)
  const canProceed =
    draft.types.length >= 1 &&
    filledMoveIds.length === 4 &&
    new Set(filledMoveIds).size === 4

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-stone-400 text-xs uppercase tracking-widest mb-2">Name</label>
        <input
          value={draft.name}
          onChange={e => update('name', e.target.value)}
          className="w-full bg-stone-900 border border-stone-700 rounded p-3 text-stone-100 text-sm focus:outline-none focus:border-stone-500"
        />
      </div>

      {/* Types */}
      <div>
        <label className="block text-stone-400 text-xs uppercase tracking-widest mb-2">
          Types (1–2 — click to toggle)
        </label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`transition-opacity ${draft.types.includes(t) ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
            >
              <TypeBadge type={t} size="sm" />
            </button>
          ))}
        </div>
      </div>

      {/* Flavor text */}
      <div>
        <label className="block text-stone-400 text-xs uppercase tracking-widest mb-2">Flavor text</label>
        <textarea
          value={draft.flavor_text}
          onChange={e => update('flavor_text', e.target.value)}
          rows={3}
          className="w-full bg-stone-900 border border-stone-700 rounded p-3 text-stone-100 text-sm italic focus:outline-none focus:border-stone-500 resize-none"
        />
      </div>

      {/* Stats */}
      <div>
        <label className="block text-stone-400 text-xs uppercase tracking-widest mb-2">
          Stats (25–80)
        </label>
        <div className="grid grid-cols-4 gap-3">
          {(['hp', 'atk', 'def', 'spd'] as const).map(stat => (
            <div key={stat}>
              <div className="text-stone-600 text-xs uppercase text-center mb-1">{stat}</div>
              <input
                type="number"
                min={25}
                max={80}
                value={draft[stat]}
                onChange={e =>
                  update(stat, Math.min(80, Math.max(25, parseInt(e.target.value) || 25)))
                }
                className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-stone-100 text-sm text-center focus:outline-none focus:border-stone-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Moves */}
      <div>
        <label className="block text-stone-400 text-xs uppercase tracking-widest mb-2">Moves</label>
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <select
              key={i}
              value={draft.move_ids[i] ?? ''}
              onChange={e => setMoveSlot(i, e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-stone-100 text-sm focus:outline-none focus:border-stone-500"
            >
              <option value="">— move {i + 1} —</option>
              {TYPES.map(type => {
                const typeMoves = moves.filter(m => m.type === type)
                if (typeMoves.length === 0) return null
                return (
                  <optgroup key={type} label={type}>
                    {typeMoves.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}{' '}
                        {m.move_type === 'attack'
                          ? `(${m.power} power)`
                          : `(${m.status_effect?.replace(/_/g, ' ')})`}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-stone-500 text-sm hover:text-stone-300 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 py-2 bg-stone-100 text-stone-950 text-sm font-medium rounded hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          This looks right →
        </button>
      </div>
    </div>
  )
}
