'use client'

import { useState } from 'react'

const TYPES = ['Fiendish', 'Elemental', 'Undead', 'Celestial', 'Aberration', 'Arcane', 'Fey', 'Beast']
const REGIONS = ['Crimson Peak', 'Weeping Depths', 'Stormcrest Spire', 'Radiant Temple', 'Umbral Vault']

interface StepConceptProps {
  onGenerate: (concept: string, hintTypes: string[], hintRegion: string) => void
  isLoading: boolean
}

export function StepConcept({ onGenerate, isLoading }: StepConceptProps) {
  const [concept, setConcept] = useState('')
  const [hintTypes, setHintTypes] = useState<string[]>([])
  const [hintRegion, setHintRegion] = useState('')

  function toggleType(type: string) {
    setHintTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  return (
    <div>
      <label className="block text-stone-400 text-xs uppercase tracking-widest mb-2">
        Describe the creature
      </label>
      <textarea
        value={concept}
        onChange={e => setConcept(e.target.value)}
        placeholder="A guardian that drowned protecting the Seal of Water. Bone and brackish water. Ancient. Patient."
        rows={4}
        className="w-full bg-stone-900 border border-stone-700 rounded p-3 text-stone-100 text-sm placeholder:text-stone-600 focus:outline-none focus:border-stone-500 mb-6 resize-none"
      />

      <div className="mb-3">
        <p className="text-stone-600 text-xs uppercase tracking-widest mb-2">Type hints (optional)</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                hintTypes.includes(t)
                  ? 'bg-stone-200 text-stone-900 border-stone-200'
                  : 'bg-transparent text-stone-500 border-stone-700 hover:border-stone-500 hover:text-stone-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <p className="text-stone-600 text-xs uppercase tracking-widest mb-2">Region hint (optional)</p>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setHintRegion(prev => prev === r ? '' : r)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                hintRegion === r
                  ? 'bg-stone-200 text-stone-900 border-stone-200'
                  : 'bg-transparent text-stone-500 border-stone-700 hover:border-stone-500 hover:text-stone-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onGenerate(concept, hintTypes, hintRegion)}
        disabled={!concept.trim() || isLoading}
        className="w-full py-3 bg-stone-100 text-stone-950 text-sm font-medium rounded hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? 'The Forge burns...' : 'Summon the Forge'}
      </button>
    </div>
  )
}
