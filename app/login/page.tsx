'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (error) setError('The vault will not open. Try again.')
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center max-w-sm">
        <p className="text-stone-300 text-lg mb-2">The message has been sent.</p>
        <p className="text-stone-500 text-sm">Check your correspondence. Return when the link arrives.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-stone-100 text-2xl font-semibold mb-2">Enter the Threshold</h1>
      <p className="text-stone-500 text-sm mb-8">A link will be sent to your correspondence address.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your correspondence address"
          required
          className="w-full bg-stone-900 border border-stone-700 text-stone-100 rounded px-4 py-3 text-sm placeholder:text-stone-600 focus:outline-none focus:border-stone-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-stone-100 text-stone-950 rounded px-4 py-3 text-sm font-semibold hover:bg-stone-200 transition-colors"
        >
          Open the Gate
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
