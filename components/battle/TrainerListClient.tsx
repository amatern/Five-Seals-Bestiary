'use client'

import { useState } from 'react'
import { TeamSelector } from '@/components/battle/TeamSelector'
import type { Creature } from '@/lib/types'
import type { Trainer } from '@/lib/battle/types'

interface Props {
  trainers: Trainer[]
  approvedCreatures: Creature[]
}

export function TrainerListClient({ trainers, approvedCreatures }: Props) {
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {trainers.map(trainer => (
          <button
            key={trainer.id}
            onClick={() => approvedCreatures.length > 0 && setSelectedTrainer(trainer)}
            disabled={approvedCreatures.length === 0}
            className="text-left bg-stone-900 border border-stone-800 rounded-lg p-4 hover:border-stone-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <h2 className="text-stone-100 text-sm font-semibold mb-1">{trainer.name}</h2>
            <p className="text-stone-600 text-xs italic mb-2">{trainer.description}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              trainer.ai_behavior === 'aggressive' ? 'bg-red-950 text-red-300'
              : trainer.ai_behavior === 'defensive' ? 'bg-blue-950 text-blue-300'
              : 'bg-stone-800 text-stone-400'
            }`}>
              {trainer.ai_behavior}
            </span>
          </button>
        ))}
      </div>

      {selectedTrainer && (
        <TeamSelector
          trainer={selectedTrainer}
          ownedCreatures={approvedCreatures}
          onCancel={() => setSelectedTrainer(null)}
        />
      )}
    </>
  )
}
