import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ForgeWizard } from '@/components/forge/ForgeWizard'
import { getMoves } from '@/lib/supabase/queries'
import type { Move } from '@/lib/types'

export default async function ForgePage() {
  // Double-check auth (proxy.ts already redirects, but a server-side check is safer)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/forge')

  let moves: Move[]
  try {
    moves = await getMoves()
  } catch {
    moves = []
  }

  return <ForgeWizard moves={moves} />
}
