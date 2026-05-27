'use client'

import { useState } from 'react'
import { BattleCreatureCard } from '@/components/battle/BattleCreatureCard'
import { MoveGrid } from '@/components/battle/MoveGrid'
import { ChronicleLog } from '@/components/battle/ChronicleLog'
import type { BattleState, BattleCreatureData, Trainer } from '@/lib/battle/types'
import type { Move } from '@/lib/types'

interface Props {
  battleId: string
  initialState: BattleState
  playerCreatures: BattleCreatureData[]  // all player creatures in team
  trainerCreatures: BattleCreatureData[] // all trainer creatures in team
  trainer: Trainer
}

export function BattleArena({
  battleId,
  initialState,
  playerCreatures,
  trainerCreatures,
  trainer,
}: Props) {
  const [state, setState] = useState<BattleState>(initialState)
  const [chronicle, setChronicle] = useState<string[]>([])
  const [isResolving, setIsResolving] = useState(false)
  const [battleOver, setBattleOver] = useState(false)
  const [winner, setWinner] = useState<'player' | 'trainer' | null>(null)

  const playerSlot = state.player_team[state.player_active_slot]
  const trainerSlot = state.trainer_team[state.trainer_active_slot]

  const playerData = playerCreatures.find(c => c.id === playerSlot.creature_id)!
  const trainerData = trainerCreatures.find(c => c.id === trainerSlot.creature_id)!

  const playerAliveCount = state.player_team.filter(c => c.current_hp > 0).length
  const trainerAliveCount = state.trainer_team.filter(c => c.current_hp > 0).length

  const activeMoves: Move[] = playerData?.moves ?? []

  async function handleMove(moveId: string) {
    if (isResolving || battleOver) return
    setIsResolving(true)

    try {
      const res = await fetch(`/api/battle/${battleId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move_id: moveId }),
      })

      if (!res.ok) {
        setChronicle(prev => [...prev, 'Something went wrong. Try again.'])
        return
      }

      const data = await res.json()

      // Append chronicle entries
      const newEntries: string[] = []
      if (data.playerTurn?.chronicle_text) newEntries.push(data.playerTurn.chronicle_text)
      if (data.aiTurn?.chronicle_text) newEntries.push(data.aiTurn.chronicle_text)
      if (data.endChronicle) newEntries.push(data.endChronicle)
      setChronicle(prev => [...prev, ...newEntries])

      setState(data.state)

      if (data.battleOver) {
        setBattleOver(true)
        setWinner(data.winner)
      }
    } finally {
      setIsResolving(false)
    }
  }

  if (battleOver) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <p className="text-stone-300 text-xl mb-3">
            {winner === 'player'
              ? `${trainer.name} is overcome. The seal holds — for now.`
              : 'Your creatures are spent. The darkness advances.'}
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-4 mb-6 max-h-40 overflow-y-auto text-left">
            {chronicle.slice(-5).map((e, i) => (
              <p key={i} className="text-stone-600 text-xs italic mb-1">{e}</p>
            ))}
          </div>
          <div className="flex gap-4 justify-center">
            <a href="/vault" className="text-stone-500 text-sm hover:text-stone-300 transition-colors">
              ← Return to Vault
            </a>
            <a href="/battle/new" className="text-stone-300 text-sm hover:text-stone-100 transition-colors">
              Challenge Again →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-stone-950 p-6">
      <div className="max-w-lg mx-auto">
        {/* Trainer info */}
        <div className="text-stone-600 text-xs mb-4 text-center">{trainer.name}</div>

        {/* Creature card */}
        <div className="mb-4">
          <BattleCreatureCard
            playerSlot={playerSlot}
            playerData={playerData}
            trainerSlot={trainerSlot}
            trainerData={trainerData}
            playerTeamSize={state.player_team.length}
            playerAliveCount={playerAliveCount}
            trainerTeamSize={state.trainer_team.length}
            trainerAliveCount={trainerAliveCount}
          />
        </div>

        {/* Chronicle */}
        <div className="mb-4">
          <ChronicleLog entries={chronicle} />
        </div>

        {/* Moves */}
        {isResolving ? (
          <div className="text-stone-600 text-xs italic text-center py-4">Resolving…</div>
        ) : (
          <MoveGrid
            moves={activeMoves}
            onMove={handleMove}
            disabled={isResolving || battleOver}
          />
        )}
      </div>
    </main>
  )
}
