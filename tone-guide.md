# Five Seals — Tone Guide

*This file governs the voice of all generated text in the game — flavor text, move names, dialogue, menu labels, dialog boxes, victory and defeat lines, error messages.*

*If a line would fit in a dusty bestiary kept in a tower at the edge of the world, it fits the game. If it would fit in a Pokémon menu, it does not.*

---

## The five adjectives

The campaign is:

1. **Grim** — the world is in trouble, the seals are failing, heroes pay for their victories.
2. **Ancient** — three hundred years of history weigh on every location. Stone is older than the people who live near it.
3. **Cosmic** — there are forces beyond the mortal scale (Tiamat, the Feywild, prophecy). Mortals are small.
4. **Melancholic** — heroes have died for this before. They will die for it again. The mood is not despairing, but it is sad.
5. **Defiant** — and yet, people keep fighting. Hope exists. It is just expensive.

When in doubt, write toward these five.

---

## Voice and vocabulary

### Words and phrases that fit

**Atmospheric verbs:** smolders, hollows, riven, gnaws, drowns, lingers, weeps, fades, awakens, stirs, burns, unmakes

**Atmospheric adjectives:** ashen, hollowed, drowned, crimson, sundered, unburied, riven, hallowed, accursed, unmade, eternal, dimming, brittle, ancient, forgotten

**Atmospheric nouns:** sentinel, reliquary, sanctum, vault, choir, hymn, herald, effigy, crone, saint, wyrm, drake, dirge, lament, bargain, oath

**Phrases:** *dawn breaks over ash, the scales will be balanced, three centuries of silence, what was sealed will rise, the Five-Headed waits, the last of its kind, the eternal flame dims*

### Words and phrases that do not fit

**Modern register:** awesome, super, cool, epic (in the modern sense), legendary (overused)

**Game-speak:** XP, level up, achievement unlocked, power-up, combo, critical hit (use *critical strike* or *true strike* instead)

**Cutesy:** little buddy, friend, partner, pal, cute, adorable, fluffy

**Pokémon-coded:** *catch, train, evolve, super-effective, not very effective, fainted, blacked out*

**Generic fantasy:** chosen one (overused), prophecy fulfilled (used sparingly only), magical (use *arcane, hallowed, accursed*)

**Cheerful exclamations:** Hooray! Yay! Great job! Wow!

---

## Tone by surface

### Flavor text (creature bestiary entries)

One to two sentences. Terse. Ominous. Lightly archaic but readable. Always written as if observed by a chronicler, not narrated to a player.

**Yes:**
> *A wyrm born in the ashes of the Second Seal's breaking. Its scales smolder even after death.*

> *The Crimson Guard once trained these to track dragons by the scent of brimstone. None remain who can command them.*

> *It speaks only in the voices of the drowned. Some who hear it sleep, and do not wake.*

**No:**
> *A cool fire dragon that lives in caves and breathes fire! Watch out for its tail!*

> *Cinderwyrm is a Fire/Dragon type creature that evolves from Emberlizard at level 16.*

### Move names

Two to three words. Concrete and elemental, not abstract and gamified.

**Yes:** Ember Breath, Tail Lash, Ash Shroud, Infernal Roar, Drowning Tide, Sundering Strike, Hollow Gaze, Bone Hymn, Reliquary's Curse, Twilight Veil, Crimson Bite, Storm-eater's Jaws

**No:** Mega Flame, Hyper Beam, Power Strike, Awesome Slash, Fire Blast III, Ultra Tackle

### Move execution dialogue (battle log)

Past tense, third person, brief. Single sentence. Avoid exclamation marks.

**Yes:**
> *The Cinderwyrm exhaled, and the air itself caught.*
> *Ash settled over the Hollow Saint.*
> *The Bone Hymn struck true. The Drowned Reliquary's marrow remembered it.*

**No:**
> *Cinderwyrm used Ember Breath! It's super effective!*
> *Wow, what a hit!*
> *Critical hit! 24 damage!*

### Type effectiveness messages

Used when a move is especially strong, neutral, or weak. Tone: archaic, slightly mournful.

**Especially effective (×2):**
- *The strike found old wounds.*
- *Even ancient things may yet burn.*
- *The seal's lesson held.*

**Neutral:** (no message — silence is the tone)

**Barely effective (×0.5):**
- *It barely flinched.*
- *The blow rolled off like rain on stone.*
- *Such things cannot be unmade so easily.*

### Victory and defeat lines

Brief. No celebration. Acknowledgment.

**Victory:**
- *The bestiary remembers.*
- *Another entry inked in blood.*
- *The chronicler writes your name.*

**Defeat:**
- *Five shall fall. You were among them.*
- *The Eternal Flame burns on.*
- *Dawn does not break for everyone.*

### Menu labels and UI text

Plain and functional, but lean archaic where natural. Slightly elevated, never modern-cheerful.

**Yes:** Bestiary, Sanctum (save menu), Forge (creature designer), The Vault (collection), Begin the Trial (start battle), Return to the Threshold (back to title)

**No:** My Creatures, Battle!, Settings, Quick Start, Profile

### Error and system messages

Keep them in voice when the situation allows. A failed save isn't a system error — it's something the chronicler notes with regret.

**Yes:**
- *The chronicler could not record this. Try again.*
- *The vault will not open. The bindings hold.*

**No:**
- *Error: localStorage write failed.*
- *Oops! Something went wrong!*

(When a real error must be visible for debugging, use plain technical language — but show it only in console, not to the player.)

---

## Things to never do

1. **Never use exclamation marks** in flavor text, battle log, or menu labels. Reserve them for Infernadax's direct speech only, and even there sparingly.
2. **Never use emoji** anywhere in the game text.
3. **Never break the fourth wall.** No references to the player, the game itself, "saving your progress," or modern computing concepts.
4. **Never reference Pokémon, Pokédex, or any specific franchise** — the game stands on its own.
5. **Never write cheerful encouragement.** No "You did it!" or "Great battle!" The tone is acknowledgment, not celebration.
6. **Never spoil the campaign.** Refer to the SPOILER markers in `world.md`.
7. **Never name Tiamat directly** in player-facing text. Use *the Dragon Queen*, *the Five-Headed*, *She Who Waits Beyond the Veil*.
8. **Never invent canon.** If the campaign hasn't established something and a creative choice is needed, ask before committing it to flavor text or move names.

---

## A few exemplars

Three full bestiary entries written in the voice the game should hold. Use these as benchmarks.

### Cinderwyrm

> *Fiendish / Elemental. A wyrm born in the ashes of the Second Seal's breaking. Its scales smolder even after death. The Crimson Guard once hunted these for sport; now the Guard is gone, and the wyrms remain.*

### Hollow Saint

> *Undead / Celestial. What is left of a cleric who refused to die. It still wears the vestments of the Order of the Radiant Dawn, though the cloth has long since turned to ash. Its prayers are silent now, but the words still move its jaw.*

### Drowned Reliquary

> *Aberration / Elemental. A vessel of bone and brackish water, sealed by some forgotten rite at the bottom of the Weeping Depths. It is full of names. When it opens, the names come out in the voices that first spoke them.*

These are the targets. If a generated entry lands here, the tone is right. If it lands closer to *"a cool fire dragon that breathes fire,"* the tone is wrong and the file should be rewritten.
