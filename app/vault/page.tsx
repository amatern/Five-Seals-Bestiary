import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getVaultCreatures } from '@/lib/supabase/queries'
import type { Creature } from '@/lib/types'

interface VaultPageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function VaultPage({ searchParams }: VaultPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vault')

  const { filter } = await searchParams
  const creatures = await getVaultCreatures()

  const filtered =
    filter === 'approved' ? creatures.filter(c => c.approved)
    : filter === 'pending'  ? creatures.filter(c => !c.approved)
    : creatures

  function filterHref(f: string) {
    return f === filter ? '/vault' : `/vault?filter=${f}`
  }

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-4xl mx-auto">
        <a href="/bestiary" className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block">
          ← The Bestiary
        </a>

        <h1 className="text-stone-100 text-3xl font-semibold mb-1">The Vault</h1>
        <p className="text-stone-600 text-sm italic mb-6">Your creatures, recorded and waiting.</p>

        {/* Filter chips */}
        <div className="flex gap-2 mb-6">
          <a
            href="/vault"
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              !filter ? 'bg-stone-600 text-stone-100' : 'border border-stone-700 text-stone-500 hover:text-stone-300'
            }`}
          >
            All ({creatures.length})
          </a>
          <a
            href={filterHref('approved')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'approved' ? 'bg-stone-600 text-stone-100' : 'border border-stone-700 text-stone-500 hover:text-stone-300'
            }`}
          >
            Approved ({creatures.filter(c => c.approved).length})
          </a>
          <a
            href={filterHref('pending')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'pending' ? 'bg-stone-600 text-stone-100' : 'border border-stone-700 text-stone-500 hover:text-stone-300'
            }`}
          >
            Pending ({creatures.filter(c => !c.approved).length})
          </a>
        </div>

        {filtered.length === 0 ? (
          <p className="text-stone-600 text-sm italic">
            {creatures.length === 0
              ? 'No creatures yet. Visit the Forge to create your first.'
              : 'No creatures match this filter.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(creature => (
              <VaultCreatureCard key={creature.id} creature={creature} />
            ))}
          </div>
        )}

        {/* Challenge CTA */}
        <div className="mt-8 pt-6 border-t border-stone-800">
          {creatures.filter(c => c.approved).length > 0 ? (
            <a
              href="/battle/new"
              className="inline-block bg-stone-100 text-stone-950 px-4 py-2 rounded text-sm font-semibold hover:bg-stone-200 transition-colors"
            >
              Challenge a Trainer →
            </a>
          ) : (
            <p className="text-stone-600 text-xs italic">
              You need at least one approved creature to challenge a trainer.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

function VaultCreatureCard({ creature }: { creature: Creature }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-stone-100 text-sm font-semibold">{creature.name}</h2>
        {creature.approved ? (
          <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Approved</span>
        ) : (
          <span className="text-xs bg-stone-700 text-stone-400 px-2 py-0.5 rounded-full">Pending</span>
        )}
      </div>

      {creature.artwork_url && (
        <img
          src={creature.artwork_url}
          alt={creature.name}
          className="w-full h-24 object-cover rounded mb-2 opacity-80"
        />
      )}

      <p className="text-stone-600 text-xs italic mb-2 line-clamp-2">{creature.flavor_text}</p>

      <div className="flex flex-wrap gap-1 mb-2">
        {creature.types.map(t => (
          <span key={t} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded">{t}</span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1 text-center text-xs">
        {(['hp', 'atk', 'def', 'spd'] as const).map(stat => (
          <div key={stat}>
            <div className="text-stone-600 uppercase">{stat}</div>
            <div className="text-stone-300">{creature[stat]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
