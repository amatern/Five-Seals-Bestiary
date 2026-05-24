import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function TitleScreen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-red-950/5 to-stone-950 pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg">
        <p className="text-stone-500 text-sm italic mb-12 leading-relaxed">
          "You come to the mountain bearing names and small bright hopes.<br />
          Infernadax has watched three hundred years of such arrivals.<br />
          He is patient. He is watching."
        </p>

        <h1 className="text-stone-100 text-5xl font-semibold tracking-wide mb-2">
          Five Seals
        </h1>
        <p className="text-stone-400 text-xl italic mb-8">Bestiary</p>

        <div className="border-t border-b border-stone-800 py-6 mb-10">
          <p className="text-stone-500 text-sm italic leading-loose">
            Seven shall stand before the Eternal Flame.<br />
            Five shall fall.<br />
            Two shall remain.<br />
            The scales will be balanced in blood and sacrifice.
          </p>
        </div>

        {user ? (
          <div className="space-y-3">
            <Link
              href="/bestiary"
              className="block w-full bg-stone-100 text-stone-950 rounded px-8 py-3 text-sm font-semibold hover:bg-stone-200 transition-colors"
            >
              Enter the Bestiary
            </Link>
            <Link
              href="/vault"
              className="block w-full border border-stone-700 text-stone-400 rounded px-8 py-3 text-sm hover:border-stone-500 hover:text-stone-300 transition-colors"
            >
              Return to the Vault
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="block w-full bg-stone-100 text-stone-950 rounded px-8 py-3 text-sm font-semibold hover:bg-stone-200 transition-colors"
          >
            Enter the Threshold
          </Link>
        )}

        <p className="text-stone-700 text-xs mt-10">
          One seal has already broken. The flame grows stronger.
        </p>
      </div>
    </main>
  )
}
