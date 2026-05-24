import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

function safeRedirectPath(value: string | null): string {
  if (!value) return '/'
  // Block protocol-relative URLs (//evil.com) and anything not starting with /
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = safeRedirectPath(searchParams.get('redirectTo'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const { error: upsertError } = await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email ?? '',
        username: data.user.email?.split('@')[0] ?? data.user.id.slice(0, 8),
      }, { onConflict: 'id', ignoreDuplicates: true })

      if (upsertError) {
        console.error('[auth/callback] users upsert failed:', upsertError)
        return NextResponse.redirect(`${origin}/login?error=auth-failed`)
      }

      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
