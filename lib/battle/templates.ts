import type { TurnRecord } from '@/lib/battle/types'

export function attackChronicle(
  attackerName: string,
  moveName: string,
  targetName: string,
  damage: number,
  effectiveness: number,
): string {
  if (effectiveness > 1.0) {
    return `${attackerName} unleashes ${moveName} and finds a weakness in ${targetName} — ${damage} damage.`
  }
  if (effectiveness < 1.0) {
    return `${attackerName}'s ${moveName} glances off ${targetName} — ${damage} damage.`
  }
  return `${attackerName} strikes ${targetName} with ${moveName} — ${damage} damage.`
}

export function drainChronicle(
  userName: string,
  moveName: string,
  targetName: string,
  damage: number,
  absorbed: number,
): string {
  return `${moveName} drains ${targetName}'s vitality — ${damage} dealt, ${absorbed} absorbed by ${userName}.`
}

export function statusChronicle(
  userName: string,
  moveName: string,
  targetName: string,
  effect: 'atk_down' | 'def_up' | 'spd_down' | 'drain',
): string {
  switch (effect) {
    case 'atk_down':
      return `${moveName} strips the edge from ${targetName}'s strikes.`
    case 'def_up':
      return `${moveName} hardens ${userName}'s defenses.`
    case 'spd_down':
      return `${moveName} slows ${targetName}'s movement.`
    case 'drain':
      return `${moveName} drains ${targetName}'s vitality.`
  }
}

export function faintChronicle(name: string): string {
  return `${name} falls.`
}

export function battleEndChronicle(winner: 'player' | 'trainer', trainerName: string): string {
  if (winner === 'player') {
    return `${trainerName} is overcome. The seal holds — for now.`
  }
  return `Your creatures are spent. The darkness advances.`
}

// Build chronicle_text for a TurnRecord given creature names
export function buildChronicle(
  turn: TurnRecord,
  attackerName: string,
  targetName: string,
  moveType: 'attack' | 'status',
  moveName: string,
  statusEffect: 'atk_down' | 'def_up' | 'spd_down' | 'drain' | null,
  faintedName: string | null,
): string[] {
  const lines: string[] = []

  if (moveType === 'attack' && turn.damage != null) {
    if (statusEffect === 'drain') {
      const absorbed = Math.round(turn.damage * 0.5)
      lines.push(drainChronicle(attackerName, moveName, targetName, turn.damage, absorbed))
    } else {
      lines.push(attackChronicle(attackerName, moveName, targetName, turn.damage, turn.effectiveness))
    }
  } else if (moveType === 'status' && statusEffect && statusEffect !== 'drain') {
    lines.push(statusChronicle(attackerName, moveName, targetName, statusEffect))
  } else if (moveType === 'status' && statusEffect === 'drain' && turn.damage != null) {
    // drain with power — treat as damage chronicle
    const absorbed = Math.round(turn.damage * 0.5)
    lines.push(drainChronicle(attackerName, moveName, targetName, turn.damage, absorbed))
  }

  if (faintedName) {
    lines.push(faintChronicle(faintedName))
  }

  return lines
}
