# Five Seals Bestiary — Game Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Project directory:** `C:\Users\amate\OneDrive\Five Seals Bestiary`

---

## Overview

A web-based creature-battling game set in the Five Seals campaign world (Forgotten Realms, northern Sword Coast, post–Spell Plague). Players design creatures using an AI-assisted wizard, build teams, and battle AI trainers whose difficulty and availability are gated to real campaign milestones. A PvP challenge system lets players battle each other asynchronously. The game's voice and mechanics are governed by `tone-guide.md` and `world.md`.

**The core loop:** Design creatures in the Forge → build a team in the Vault → battle AI trainers → challenge other players.

---

## Roles

### Admin (Andreas and/or Jonas)
- Create and edit creatures directly (no wizard required)
- Create AI trainer NPCs, assign their teams and battle dialogue
- Manage campaign gates (unlock content after real sessions)
- Approve or reject player-submitted creatures before they appear in the shared Bestiary
- Manage player accounts and admin grants

### Player (Jonas's friends and other campaign members)
- Create an account at the shared URL
- Design creatures via the Forge wizard (submitted creatures go to admin for approval)
- Build a personal team of up to 6 creatures from the Bestiary
- Battle AI trainers and other players
- View and share a public trainer profile

---

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Next.js (React) | App Router, TypeScript |
| Backend | Next.js API Routes | Serverless functions on Vercel |
| Database | Supabase (Postgres) | Row-level security enforced |
| Auth | Supabase Auth | Magic link + Google OAuth |
| AI (text) | Anthropic API — Claude | Creature generation in the Forge |
| AI (image) | DALL-E 3 (OpenAI) | Optional AI image generation; swappable |
| Storage | Supabase Storage | Creature artwork |
| Deployment | Vercel | Automatic deploys from main branch |

All services are free-tier friendly for a small player group.

---

## Screens

### Player-facing

| Screen | Path | Description |
|--------|------|-------------|
| Title | `/` | Infernadax's voice, the Prophecy stanza, enter button |
| Bestiary | `/bestiary` | Browse all creatures; filter by type, region, seal; canon entries marked with sigil |
| Creature detail | `/bestiary/[id]` | Full lore entry, stat block, move list, artwork |
| The Forge | `/forge` | 4-step creature creation wizard |
| The Vault | `/vault` | Personal creature collection; assemble battle team |
| Battle arena | `/battle/[id]` | Turn-by-turn combat UI with Chronicle log |
| Trainer select | `/trainers` | Browse unlocked AI trainers; start a battle |
| PvP challenges | `/challenges` | Pending and active async PvP battles |
| Trainer profile | `/trainers/[username]` | Public profile; shareable URL |

### Admin-only

| Screen | Path | Description |
|--------|------|-------------|
| Creature manager | `/admin/creatures` | Create/edit creatures directly; approve submitted creatures |
| Trainer builder | `/admin/trainers` | Create AI trainer NPCs with teams and dialogue |
| Campaign gates | `/admin/gates` | Toggle panel to unlock content after campaign milestones |
| Player manager | `/admin/players` | View all players; grant/revoke admin |

---

## Data Model

### `users`
```
id            uuid PK
email         text
username      text unique
is_admin      boolean default false
created_at    timestamptz
```

### `creatures`
```
id            uuid PK
name          text
types         text[]          -- e.g. ["Fiendish", "Elemental"]
flavor_text   text
hp            int
atk           int
def           int
spd           int
origin        text            -- "canon" | "player-designed" | "admin-designed"
creator_id    uuid FK users   -- null for canon
artwork_url   text            -- Supabase Storage URL
approved      boolean default false  -- canon and admin-designed creatures seeded as true; player-designed default false until admin approves
created_at    timestamptz
```

### `moves`
```
id            uuid PK
name          text
type          text            -- creature type this move belongs to
power         int             -- null for status moves
move_type     text            -- "attack" | "status"
status_effect text            -- null for attacks; one of: "atk_down" | "def_up" | "spd_down" | "drain"
description   text            -- flavor description for move execution in Chronicle
```

### `creature_moves`
```
creature_id   uuid FK creatures
move_id       uuid FK moves
slot          int             -- 1–4
PRIMARY KEY (creature_id, slot)
```

### `trainers`
```
id            uuid PK
name          text
description   text
intro_text    text            -- shown before battle starts, in game voice
win_text      text            -- shown when trainer wins
loss_text     text            -- shown when trainer loses
ai_behavior   text            -- "aggressive" | "defensive" | "balanced"
gate_key      text FK campaign_gates  -- null = always available
created_at    timestamptz
```

### `trainer_creatures`
```
trainer_id    uuid FK trainers
creature_id   uuid FK creatures
slot          int             -- 1–6
PRIMARY KEY (trainer_id, slot)
```

### `campaign_gates`
```
key           text PK         -- e.g. "stormcrest-spire", "seal-of-water"
label         text            -- human-readable for admin panel
description   text            -- what unlocks when this gate opens
unlocked      boolean default false
unlocked_at   timestamptz
```

### `battles`
```
id            uuid PK
type          text            -- "vs-ai" | "pvp"
challenger_id uuid FK users
opponent_id   uuid FK users   -- null for vs-ai
trainer_id    uuid FK trainers -- null for pvp
status        text            -- "pending" | "active" | "complete"
winner_id     uuid FK users   -- null until complete; null after completion means the AI trainer won (vs-ai only)
created_at    timestamptz
```

### `battle_teams`
```
battle_id     uuid FK battles
user_id       uuid FK users
creature_id   uuid FK creatures
slot          int             -- 1–6
PRIMARY KEY (battle_id, user_id, slot)
```

### `battle_turns`
```
id            uuid PK
battle_id     uuid FK battles
turn_number   int
acting_user_id uuid FK users  -- null when the acting side is an AI trainer
creature_id   uuid FK creatures
move_id       uuid FK moves
damage        int             -- null for status moves
effectiveness text            -- "strong" | "neutral" | "weak" | null
chronicle_text text           -- the resolved battle log line, in game voice
submitted_at  timestamptz
```
Each resolved turn produces two rows: one for the player's action, one for the AI/opponent's action (ordered by speed priority).

### `type_effectiveness`
```
attacking_type  text
defending_type  text
modifier        numeric       -- 2.0 | 1.0 | 0.5
PRIMARY KEY (attacking_type, defending_type)
```
Seeded at init from a canonical effectiveness matrix. Types: Fiendish, Elemental, Undead, Celestial, Aberration, Arcane, Fey, Beast.

---

## The Forge — Creature Creation Wizard

### Step 1: Concept
- Free-text concept description (required)
- Optional hint tags: type chips (Fiendish, Elemental, Undead, Celestial, Aberration, Arcane, Fey, Beast) and region chips (Crimson Peak, Weeping Depths, Stormcrest Spire, Radiant Temple, Umbral Vault, Phandalin)
- "Summon the Forge" triggers the Claude API call

### Step 2: Draft (Claude-generated, all fields editable)
Claude is called with a system prompt that includes `world.md` and `tone-guide.md` as context. It returns:
- `name` — two-word compound or archaic title, follows naming conventions
- `types` — 1–2 types from the canonical list
- `flavor_text` — 1–2 sentences, terse, ominous, lightly archaic, chronicler voice
- `moves` — array of 4: `{ name, type, move_type, power }`
- `stats` — `{ hp, atk, def, spd }` — balanced for the creature's concept

The player edits any field inline before proceeding.

### Step 3: Artwork (three modes, combinable)
- **Draw in-app** — HTML5 canvas with pen/eraser tools, brush size slider, curated color palette (dark fantasy tones). Canvas exported as PNG on save.
- **Generate with AI** — sends the concept description to DALL-E 3 with a style prompt calibrated to the game's aesthetic (dark fantasy illustration, bestiary-style). Player can regenerate. "Draw on top →" sends the generated image to the canvas as a locked base layer.
- **Upload** — drag-and-drop or file picker. Accepts JPG, PNG, WebP. "Refine with canvas →" sends the upload to the canvas for touch-up.

All three modes write to the same canvas before saving. Final image saved to Supabase Storage.

### Step 4: Vault
Creature is saved to the player's personal Vault. Two options:
- **Keep it private** — only visible in the player's Vault
- **Submit to Bestiary** — enters admin approval queue; appears in the shared Bestiary once approved, marked with the player's username

---

## Battle System

### Setup
- Player selects a team of up to 6 creatures from their Vault
- For vs-AI: player selects an unlocked trainer; battle begins immediately
- For PvP: player sends a challenge link; opponent selects their team and submits their first move

### Turn structure
Each turn:
1. Player selects one of their active creature's 4 moves
2. For vs-AI: server immediately resolves the turn (player move + AI move, speed priority determines order)
3. For PvP: move is stored; opponent is notified; opponent submits their move; server resolves
4. Resolution produces a `chronicle_text` line for each action in the game's voice

### Damage formula
```
damage = (move.power * attacker.atk) / defender.def * effectiveness_modifier
```
Effectiveness modifiers: strong (×2), neutral (×1), weak (×0.5)

Type effectiveness is defined in a `type_effectiveness` table seeded at init.

### Chronicle (battle log)
- All events written in the game's voice per `tone-guide.md`
- Move execution: past tense, third person, single sentence
- Type effectiveness: quiet italicized line
  - Strong: *"The strike found old wounds."*
  - Weak: *"It barely flinched."*
  - Neutral: (no line)
- Creature falls: *"The [name] was unmade."*
- Victory: *"The bestiary remembers."*
- Defeat: *"Five shall fall. You were among them."*

### Status moves
Status moves have `power = null` and apply one of the following effects instead of dealing damage:
- `atk_down` — reduce opponent's effective ATK by 25% for 3 turns
- `def_up` — increase own effective DEF by 25% for 3 turns
- `spd_down` — reduce opponent's effective SPD by 25% for 3 turns (affects turn order)
- `drain` — restore HP equal to 15% of own max HP

Each status move specifies its effect in a `status_effect` column on the `moves` table (added to schema above).

### AI trainer behavior
- `aggressive` — always picks highest-power move; ignores status moves
- `defensive` — uses status moves when available and own HP > 50%; switches to highest-power attack when HP < 30%
- `balanced` — weighted random selection, biased toward type advantage; uses status moves ~30% of turns

### Team depletion
When all 6 of a side's creatures fall, the battle ends. No switching mid-battle in MVP — the active creature fights until it falls, then the next creature in the team automatically enters.

---

## Campaign Gates

A simple key-value table of named gates. Each trainer and each creature can reference a gate key. When a gate is unlocked (admin toggles it), all content behind that gate becomes available to all players simultaneously.

Suggested initial gates (can be extended):

| Key | Unlocks |
|-----|---------|
| `always` | Starter trainers (Dragonclaw cultists), canon creatures |
| `seal-of-water` | Thessalmar battle, Drowned Reliquary creature |
| `stormcrest-spire` | Silvaclaw battle, Stormcrest Sentinel creature |
| `radiant-temple` | Vexmire battle, Hollow Saint creature |
| `umbral-vault` | Nyx battle, Shadow-touched Monk creature |
| `five-seals-broken` | Infernadax (locked entry becomes battleable) |

---

## Trainer Builder (Admin)

Admin can create AI trainer NPCs with:
- Name, description (shown on trainer select screen)
- `intro_text`, `win_text`, `loss_text` — written in the game's voice; Claude can assist on request
- AI behavior: aggressive / defensive / balanced
- Creature team: up to 6 creatures selected from the Bestiary
- Campaign gate: which gate must be open for this trainer to appear

---

## Sharing & Profiles

Each player has a public trainer profile at `/trainers/[username]`:
- Display name and join date
- Creature roster (designed creatures they've made public)
- Battle record (wins / losses vs AI and PvP)
- Active PvP challenges (accept challenge from this profile)

The profile URL is the share link. No account needed to *view* a profile; an account is needed to accept a challenge.

---

## Error Handling

All errors shown to players use the game's voice:

| Situation | Player-facing message |
|-----------|----------------------|
| Forge generation fails | *"The Forge did not answer. Try again when the flame is steadier."* |
| Save fails | *"The chronicler could not record this. Try again."* |
| Battle state conflict | *"The seal holds. Return when the bindings have settled."* |
| Auth required | *"The vault will not open without a name."* |

Technical error details logged to console only, never shown to players.

---

## Testing Approach

- **Unit tests** — battle resolution engine (damage formula, type effectiveness, turn order, AI behavior)
- **Integration tests** — Forge API endpoint (Claude call → stat block validation), battle turn submission
- **E2E tests (Playwright)** — Forge wizard full flow, battle flow vs AI, admin gate toggle → trainer unlock
- Supabase row-level security policies tested with separate user contexts

---

## Out of Scope for MVP

- Live (simultaneous) PvP battles — async only
- Creature trading between players
- Leaderboards or rankings
- Mobile app (web app is mobile-responsive but not native)
- Infernadax as a battleable encounter — locked entry only until final campaign gate
- Tiamat — not referenced by name in any player-facing text
- Spoiler content from `world.md` — none surfaced in game text
