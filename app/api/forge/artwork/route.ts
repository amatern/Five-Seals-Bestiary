import { NextResponse, type NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { concept?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { concept } = body
  if (!concept || typeof concept !== 'string' || !concept.trim()) {
    return NextResponse.json({ error: 'concept is required' }, { status: 400 })
  }

  // Generate with DALL-E 3
  const openai = new OpenAI()
  let openaiUrl: string
  try {
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Dark fantasy bestiary illustration: ${concept.trim()}. Style: medieval manuscript art, muted dark tones, ominous atmosphere, single creature centered on a dark background, highly detailed line work. No text, no labels, no borders.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    })
    openaiUrl = result.data[0].url!
  } catch (err) {
    console.error('[forge/artwork] OpenAI error:', err)
    return NextResponse.json({ error: 'generation-failed' }, { status: 502 })
  }

  // Fetch the generated image and upload to Supabase Storage
  // (OpenAI URLs expire after ~1 hour — store it ourselves)
  try {
    const imageBuffer = await fetch(openaiUrl).then(r => r.arrayBuffer())
    const filename = `${user.id}/${Date.now()}.png`

    const { error: uploadError } = await supabase.storage
      .from('artwork')
      .upload(filename, imageBuffer, { contentType: 'image/png', upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(filename)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[forge/artwork] Storage upload error:', err)
    return NextResponse.json({ error: 'artwork-storage-failed' }, { status: 502 })
  }
}
