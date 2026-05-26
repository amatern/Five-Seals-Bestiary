'use client'

import { TypeBadge } from '@/components/TypeBadge'
import type { ForgeDraft } from '@/lib/forge/types'

interface StepVaultProps {
  draft: ForgeDraft
  artworkUrl: string | null
  onSave: (submitToBestiary: boolean) => void
  onBack: () => void
  isLoading: boolean
}

export function StepVault({ draft, artworkUrl, onSave, onBack, isLoading }: StepVaultProps) {
  return (
    <div>
      <h2 className="text-stone-400 text-xs uppercase tracking-widest mb-6">The Vault</h2>

      {/* Summary card */}
      <div className="p-5 bg-stone-900 rounded border border-stone-800 mb-8">
        <div className="flex gap-4 mb-4">
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt="Creature artwork"
              className="w-20 h-20 object-cover rounded border border-stone-700 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <h3 className="text-stone-100 text-lg font-semibold mb-1 truncate">{draft.name}</h3>
            <div className="flex gap-1 flex-wrap">
              {draft.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
            </div>
          </div>
        </div>
        <p className="text-stone-400 text-sm italic mb-4 leading-relaxed">{draft.flavor_text}</p>
        <div className="grid grid-cols-4 gap-3 pt-3 border-t border-stone-800">
          {(['hp', 'atk', 'def', 'spd'] as const).map(stat => (
            <div key={stat} className="text-center">
              <div className="text-stone-600 text-xs uppercase">{stat}</div>
              <div className="text-stone-100 text-lg font-semibold">{draft[stat]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-6">
        <button
          type="button"
          onClick={() => onSave(false)}
          disabled={isLoading}
          className="w-full py-3 border border-stone-700 text-stone-300 text-sm rounded hover:border-stone-500 hover:text-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Recording...' : 'Add to Vault (private)'}
        </button>
        <button
          type="button"
          onClick={() => onSave(true)}
          disabled={isLoading}
          className="w-full py-3 bg-stone-100 text-stone-950 text-sm font-medium rounded hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Recording...' : 'Submit to Bestiary'}
        </button>
        <p className="text-stone-700 text-xs text-center">
          Submitted creatures await the chronicler's approval before appearing in the shared Bestiary.
        </p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-stone-500 text-sm hover:text-stone-300 transition-colors"
      >
        ← Back
      </button>
    </div>
  )
}
