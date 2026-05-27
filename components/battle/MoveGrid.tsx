'use client'

import type { Move } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  Fiendish:   'bg-red-950 text-red-200 hover:bg-red-900',
  Elemental:  'bg-blue-950 text-blue-200 hover:bg-blue-900',
  Undead:     'bg-purple-950 text-purple-200 hover:bg-purple-900',
  Celestial:  'bg-yellow-950 text-yellow-200 hover:bg-yellow-900',
  Aberration: 'bg-teal-950 text-teal-200 hover:bg-teal-900',
  Arcane:     'bg-indigo-950 text-indigo-200 hover:bg-indigo-900',
  Fey:        'bg-pink-950 text-pink-200 hover:bg-pink-900',
  Beast:      'bg-amber-950 text-amber-200 hover:bg-amber-900',
}

const TYPE_LABEL_COLORS: Record<string, string> = {
  Fiendish:   'text-red-400',
  Elemental:  'text-blue-400',
  Undead:     'text-purple-400',
  Celestial:  'text-yellow-400',
  Aberration: 'text-teal-400',
  Arcane:     'text-indigo-400',
  Fey:        'text-pink-400',
  Beast:      'text-amber-400',
}

function effectLabel(move: Move): string {
  if (move.move_type === 'attack' && move.power != null) return `${move.power} pwr`
  if (move.status_effect === 'atk_down') return 'ATK ↓'
  if (move.status_effect === 'def_up') return 'DEF ↑'
  if (move.status_effect === 'spd_down') return 'SPD ↓'
  if (move.status_effect === 'drain') return 'Drain'
  return ''
}

interface Props {
  moves: Move[]
  onMove: (moveId: string) => void
  disabled: boolean
}

export function MoveGrid({ moves, onMove, disabled }: Props) {
  return (
    <div>
      <div className="text-stone-600 text-xs uppercase tracking-widest mb-2">Choose a move</div>
      <div className="grid grid-cols-2 gap-2">
        {moves.map(move => (
          <button
            key={move.id}
            onClick={() => onMove(move.id)}
            disabled={disabled}
            className={`text-left p-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              TYPE_COLORS[move.type] ?? 'bg-stone-800 text-stone-200 hover:bg-stone-700'
            }`}
          >
            <div className="text-sm font-semibold mb-0.5">{move.name}</div>
            <div className={`text-xs ${TYPE_LABEL_COLORS[move.type] ?? 'text-stone-400'}`}>
              {move.type} · {effectLabel(move)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
