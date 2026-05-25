import Link from 'next/link'
import { TypeBadge } from '@/components/TypeBadge'
import type { Creature } from '@/lib/types'

interface CreatureCardProps {
  creature: Creature
}

export function CreatureCard({ creature }: CreatureCardProps) {
  return (
    <Link
      href={`/bestiary/${creature.id}`}
      className="block bg-stone-900 rounded border border-stone-800 hover:border-stone-600 transition-colors p-4"
    >
      <div className="w-full aspect-square bg-stone-950 rounded mb-3 overflow-hidden border border-stone-800 flex items-center justify-center">
        {creature.artwork_url ? (
          <img
            src={creature.artwork_url}
            alt={creature.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-stone-800 text-2xl select-none">—</span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 mb-1">
        <h2 className="text-stone-100 text-sm font-semibold leading-tight">{creature.name}</h2>
        {creature.origin === 'canon' && (
          <span className="text-stone-500 text-xs flex-shrink-0">✦</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {creature.types.map(t => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>

      <p className="text-stone-600 text-xs italic leading-relaxed line-clamp-2">
        {creature.flavor_text}
      </p>

      <div className="grid grid-cols-4 gap-1 mt-3 pt-3 border-t border-stone-800">
        {[
          { label: 'HP',  value: creature.hp },
          { label: 'ATK', value: creature.atk },
          { label: 'DEF', value: creature.def },
          { label: 'SPD', value: creature.spd },
        ].map(stat => (
          <div key={stat.label} className="text-center">
            <div className="text-stone-600 text-xs">{stat.label}</div>
            <div className="text-stone-300 text-sm font-medium">{stat.value}</div>
          </div>
        ))}
      </div>
    </Link>
  )
}
