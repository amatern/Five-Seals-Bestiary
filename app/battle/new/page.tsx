import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTrainers, getVaultCreatures } from '@/lib/supabase/queries'
import { TrainerListClient } from '@/components/battle/TrainerListClient'

export default async function BattleNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/battle/new')

  const [trainers, allCreatures] = await Promise.all([getTrainers(), getVaultCreatures()])
  const approvedCreatures = allCreatures.filter(c => c.approved)

  return (
    <main className="min-h-screen bg-stone-950 p-8">
      <div className="max-w-3xl mx-auto">
        <a href="/vault" className="text-stone-600 text-xs hover:text-stone-400 transition-colors mb-8 inline-block">
          ← The Vault
        </a>
        <h1 className="text-stone-100 text-3xl font-semibold mb-1">Choose a Trainer</h1>
        <p className="text-stone-600 text-sm italic mb-6">Each holds a piece of what threatens the seals.</p>

        {approvedCreatures.length === 0 && (
          <p className="text-stone-600 text-sm italic mb-6">
            You need at least one approved creature. <a href="/forge" className="text-stone-400 underline">Forge one first.</a>
          </p>
        )}

        <TrainerListClient trainers={trainers} approvedCreatures={approvedCreatures} />
      </div>
    </main>
  )
}
