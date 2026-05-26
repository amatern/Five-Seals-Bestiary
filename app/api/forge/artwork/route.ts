import { NextResponse, type NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
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

  // Generate with Gemini Imagen 3
  // Image comes back as base64 bytes — no URL expiry concern
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  let imageBytes: string
  try {
    const result = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `Dark fantasy bestiary illustration: ${concept.trim()}. Style: medieval manuscript art, muted dark tones, ominous atmosphere, single creature centered on a dark background, highly detailed line work. No text, no labels, no borders.`,
      config: { numberOfImages: 1 },
    })
    const generated = result.generatedImages?.[0]?.image?.imageBytes
    if (!generated) throw new Error('No image returned')
    imageBytes = generated
  } catch (err) {
    console.error('[forge/artwork] Gemini Imagen error:', err)
    return NextResponse.json({ error: 'generation-failed' }, { status: 502 })
  }

  // Decode base64 and upload to Supabase Storage
  try {
    const buffer = Buffer.from(imageBytes, 'base64')
    const filename = `${user.id}/${Date.now()}.png`

    const { error: uploadError } = await supabase.storage
      .from('artwork')
      .upload(filename, buffer, { contentType: 'image/png', upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(filename)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[forge/artwork] Storage upload error:', err)
    return NextResponse.json({ error: 'artwork-storage-failed' }, { status: 502 })
  }
}
