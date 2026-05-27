'use client'

import type { BattleCreature, BattleCreatureData } from '@/lib/battle/types'

interface Props {
  playerSlot: BattleCreature
  playerData: BattleCreatureData
  trainerSlot: BattleCreature
  trainerData: BattleCreatureData
  playerTeamSize: number
  playerAliveCount: number
  trainerTeamSize: number
  trainerAliveCount: number
}

function HpBar({ current, max, side }: { current: number; max: number; side: 'player' | 'trainer' }) {
  const pct = Math.max(0, Math.round((current / max) * 100))
  const color =
    pct > 50 ? 'bg-emerald-500'
    : pct > 20 ? 'bg-yellow-500'
    : 'bg-red-500'
  return (
    <div className="bg-stone-700 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TeamDots({ total, alive, side }: { total: number; alive: number; side: 'player' | 'trainer' }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < alive
              ? side === 'player' ? 'bg-emerald-500' : 'bg-red-500'
              : 'bg-stone-700'
          }`}
        />
      ))}
    </div>
  )
}

export function BattleCreatureCard({
  playerSlot,
  playerData,
  trainerSlot,
  trainerData,
  playerTeamSize,
  playerAliveCount,
  trainerTeamSize,
  trainerAliveCount,
}: Props) {
  return (
    <div>
      {/* Panoramic artwork banner */}
      <div className="flex h-24 rounded-lg overflow-hidden mb-3 bg-stone-900">
        <div className="flex-1 relative">
          {playerData && (
            playerSlot.current_hp > 0 ? (
              playerData.id && (
                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                  {/* artwork placeholder — replaced by actual img when available */}
                  <div className="w-16 h-16 bg-stone-700 rounded-full flex items-center justify-center text-stone-500 text-xs">
                    {playerData.name[0]}
                  </div>
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <span className="text-stone-500 text-xs">Fainted</span>
              </div>
            )
          )}
        </div>
        <div className="flex items-center px-2 text-stone-600 text-xs font-light">vs</div>
        <div className="flex-1 relative">
          {trainerData && (
            trainerSlot.current_hp > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <div className="w-16 h-16 bg-stone-700 rounded-full flex items-center justify-center text-stone-500 text-xs">
                  {trainerData.name[0]}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <span className="text-stone-500 text-xs">Fainted</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Names + HP */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-stone-100 text-sm font-semibold">{playerData.name}</span>
            <span className="text-stone-500 text-xs">{playerSlot.current_hp}/{playerSlot.max_hp}</span>
          </div>
          <HpBar current={playerSlot.current_hp} max={playerSlot.max_hp} side="player" />
          <div className="mt-1.5">
            <TeamDots total={playerTeamSize} alive={playerAliveCount} side="player" />
          </div>
        </div>
        <div className="text-right">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-stone-500 text-xs">{trainerSlot.current_hp}/{trainerSlot.max_hp}</span>
            <span className="text-stone-100 text-sm font-semibold">{trainerData.name}</span>
          </div>
          <HpBar current={trainerSlot.current_hp} max={trainerSlot.max_hp} side="trainer" />
          <div className="mt-1.5 flex justify-end">
            <TeamDots total={trainerTeamSize} alive={trainerAliveCount} side="trainer" />
          </div>
        </div>
      </div>
    </div>
  )
}
