import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

function safeRedirectPath(value: string | null): string {
  if (!value) return '/'
  // Block protocol-relative URLs (//evil.com) and anything not starting with /
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

async function upsertProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string },
  origin: string,
  redirectTo: string
) {
  const { error: upsertError } = await supabase.from('users').upsert({
    id: user.id,
    email: user.email ?? '',
    username: user.email?.split('@')[0] ?? user.id.slice(0, 8),
  }, { onConflict: 'id', ignoreDuplicates: true })

  if (upsertError) {
    console.error('[auth/callback] users upsert failed:', upsertError)
    return NextResponse.redirect(`${origin}/login?error=auth-failed`)
  }

  return NextResponse.redirect(`${origin}${redirectTo}`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const redirectTo = safeRedirectPath(searchParams.get('redirectTo'))
  const supabase = await createClient()

  // PKCE flow — magic link with code verifier
  const code = searchParams.get('code')
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      return upsertProfile(supabase, data.user, origin, redirectTo)
    }
    return NextResponse.redirect(`${origin}/login?error=auth-failed`)
  }

  // Token hash flow — email confirmation or OTP link
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error && data.user) {
      return upsertProfile(supabase, data.user, origin, redirectTo)
    }
    return NextResponse.redirect(`${origin}/login?error=auth-failed`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
