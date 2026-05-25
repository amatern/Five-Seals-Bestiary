import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getMoves } from '@/lib/supabase/queries'
import { FORGE_SYSTEM_PROMPT, buildForgeUserMessage } from '@/lib/forge/prompt'

const CREATURE_TOOL: Anthropic.Tool = {
  name: 'create_creature',
  description: 'Design a creature for the Five Seals Bestiary',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Creature name — two-word compound or archaic title',
      },
      types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['Fiendish', 'Elemental', 'Undead', 'Celestial', 'Aberration', 'Arcane', 'Fey', 'Beast'],
        },
        minItems: 1,
        maxItems: 2,
        description: '1 or 2 types from the canonical list',
      },
      flavor_text: {
        type: 'string',
        description: '1–2 sentences, terse, ominous, chronicler voice. No exclamation marks.',
      },
      hp:  { type: 'number', description: 'Hit points (25–80)' },
      atk: { type: 'number', description: 'Attack power (25–80)' },
      def: { type: 'number', description: 'Defense (25–80)' },
      spd: { type: 'number', description: 'Speed (25–80)' },
      move_names: {
        type: 'array',
        items: { type: 'string' },
        minItems: 4,
        maxItems: 4,
        description: 'Exactly 4 move names chosen from the provided list — exact spelling required',
      },
    },
    required: ['name', 'types', 'flavor_text', 'hp', 'atk', 'def', 'spd', 'move_names'],
  },
}

function clampStat(n: unknown): number {
  return Math.min(80, Math.max(25, Math.round(Number(n) || 25)))
}

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { concept?: string; hint_types?: string[]; hint_region?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { concept, hint_types = [], hint_region = '' } = body
  if (!concept || typeof concept !== 'string' || !concept.trim()) {
    return NextResponse.json({ error: 'concept is required' }, { status: 400 })
  }

  // Load available moves (reuse the shared query)
  let moves
  try {
    moves = await getMoves()
  } catch {
    return NextResponse.json({ error: 'Failed to load moves' }, { status: 500 })
  }

  // Call Claude
  const anthropic = new Anthropic()
  const userMessage = buildForgeUserMessage(concept.trim(), hint_types, hint_region, moves)
  let claudeResponse: Anthropic.Message
  try {
    claudeResponse = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: FORGE_SYSTEM_PROMPT,
      tools: [CREATURE_TOOL],
      tool_choice: { type: 'tool', name: 'create_creature' },
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (err) {
    console.error('[forge/generate] Anthropic error:', err)
    return NextResponse.json({ error: 'generation-failed' }, { status: 502 })
  }

  // Extract tool_use block
  const toolUse = claudeResponse.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use'
  )
  if (!toolUse) {
    return NextResponse.json({ error: 'generation-failed' }, { status: 502 })
  }

  const input = toolUse.input as {
    name: string
    types: string[]
    flavor_text: string
    hp: number
    atk: number
    def: number
    spd: number
    move_names: string[]
  }

  // Resolve move names → IDs
  const moveMap = new Map(moves.map(m => [m.name, m.id]))
  const move_ids = (input.move_names ?? [])
    .map(name => moveMap.get(name))
    .filter((id): id is string => id !== undefined)
    .slice(0, 4)

  return NextResponse.json({
    name: input.name,
    types: input.types,
    flavor_text: input.flavor_text,
    hp:  clampStat(input.hp),
    atk: clampStat(input.atk),
    def: clampStat(input.def),
    spd: clampStat(input.spd),
    move_ids,
  })
}
