import Link from 'next/link'
import { getApprovedCreatures } from '@/lib/supabase/queries'
import { CreatureCard } from '@/components/CreatureCard'

const TYPES = [
  'Fiendish', 'Elemental', 'Undead', 'Celestial',
  'Aberration', 'Arcane', 'Fey', 'Beast',
]

const SEALS = [
  { key: 'always',           label: 'Always' },
  { key: 'seal-of-water',    label: 'Seal of Water' },
  { key: 'stormcrest-spire', label: 'Stormcrest Spire' },
  { key: 'radiant-temple',   label: 'Radiant Temple' },
  { key: 'umbral-vault',     label: 'Umbral Vault' },
]

function chipClass(active: boolean) {
  return active
    ? 'bg-stone-100 text-stone-950 border-stone-100'
    : 'bg-transparent text-stone-500 border-stone-700 hover:border-stone-500 hover:text-stone-300'
}

export default async function BestiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; seal?: string }>
}) {
  const { type, seal } = await searchParams
  const creatures = await getApprovedCreatures({
    type: type || undefined,
    gate_key: seal || undefined,
  })

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block">
          ← Return
        </Link>

        <h1 className="text-stone-100 text-3xl font-semibold mb-1">The Bestiary</h1>
        <p className="text-stone-600 text-sm italic mb-8">
          The chronicler records what walks in the dark.
        </p>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Link
            href={seal ? `/bestiary?seal=${seal}` : '/bestiary'}
            className={`px-3 py-1 rounded text-xs border transition-colors ${chipClass(!type)}`}
          >
            All types
          </Link>
          {TYPES.map(t => (
            <Link
              key={t}
              href={`/bestiary?type=${t}${seal ? `&seal=${seal}` : ''}`}
              className={`px-3 py-1 rounded text-xs border transition-colors ${chipClass(type === t)}`}
            >
              {t}
            </Link>
          ))}
        </div>

        {/* Seal filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Link
            href={type ? `/bestiary?type=${type}` : '/bestiary'}
            className={`px-3 py-1 rounded text-xs border transition-colors ${chipClass(!seal)}`}
          >
            All seals
          </Link>
          {SEALS.map(s => (
            <Link
              key={s.key}
              href={`/bestiary?seal=${s.key}${type ? `&type=${type}` : ''}`}
              className={`px-3 py-1 rounded text-xs border transition-colors ${chipClass(seal === s.key)}`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {creatures.length === 0 ? (
          <p className="text-stone-700 italic text-sm">Nothing has been recorded here.</p>
        ) : (
          <>
            <p className="text-stone-600 text-xs mb-4">{creatures.length} recorded</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {creatures.map(creature => (
                <CreatureCard key={creature.id} creature={creature} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
