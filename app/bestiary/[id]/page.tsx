import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCreatureWithMoves } from '@/lib/supabase/queries'
import { TypeBadge } from '@/components/TypeBadge'

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const creature = await getCreatureWithMoves(id)
  if (!creature) notFound()

  const moves = [...creature.creature_moves].sort((a, b) => a.slot - b.slot)

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/bestiary"
          className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block"
        >
          ← The Bestiary
        </Link>

        {/* Header: artwork + name + types + flavor */}
        <div className="flex gap-5 mb-8">
          <div className="w-36 h-36 flex-shrink-0 bg-stone-900 rounded border border-stone-800 overflow-hidden flex items-center justify-center">
            {creature.artwork_url ? (
              <img
                src={creature.artwork_url}
                alt={creature.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-stone-700 text-3xl select-none">—</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-stone-100 text-2xl font-semibold">{creature.name}</h1>
              {creature.origin === 'canon' && (
                <span className="text-stone-600 text-xs border border-stone-700 rounded px-1.5 py-0.5">
                  ✦ canon
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {creature.types.map(t => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <p className="text-stone-400 text-sm italic leading-relaxed">
              {creature.flavor_text}
            </p>
          </div>
        </div>

        {/* Stat block */}
        <div className="grid grid-cols-4 gap-4 p-5 bg-stone-900 rounded border border-stone-800 mb-8">
          {[
            { label: 'HP',  value: creature.hp },
            { label: 'ATK', value: creature.atk },
            { label: 'DEF', value: creature.def },
            { label: 'SPD', value: creature.spd },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-stone-500 text-xs mb-1 uppercase tracking-widest">{stat.label}</div>
              <div className="text-stone-100 text-2xl font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Move list */}
        <h2 className="text-stone-600 text-xs uppercase tracking-widest mb-3">Moves</h2>
        <div className="space-y-2 mb-8">
          {moves.map(({ slot, move }) => (
            <div key={slot} className="p-4 bg-stone-900 rounded border border-stone-800">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <TypeBadge type={move.type} size="sm" />
                <span className="text-stone-100 text-sm font-medium">{move.name}</span>
                <span className="ml-auto text-stone-500 text-xs">
                  {move.move_type === 'attack'
                    ? `${move.power} power`
                    : (move.status_effect?.replace(/_/g, ' ') ?? '')}
                </span>
              </div>
              <p className="text-stone-500 text-xs italic">{move.description}</p>
            </div>
          ))}
        </div>

        {creature.creator_id && (
          <p className="text-stone-700 text-xs italic">Designed by a chronicler.</p>
        )}
      </div>
    </main>
  )
}
