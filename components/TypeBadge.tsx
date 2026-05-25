const TYPE_STYLES: Record<string, string> = {
  Fiendish:   'bg-red-950 text-red-300 border-red-900',
  Elemental:  'bg-blue-950 text-blue-300 border-blue-900',
  Undead:     'bg-purple-950 text-purple-300 border-purple-900',
  Celestial:  'bg-yellow-950 text-yellow-200 border-yellow-900',
  Aberration: 'bg-green-950 text-green-300 border-green-900',
  Arcane:     'bg-indigo-950 text-indigo-300 border-indigo-900',
  Fey:        'bg-emerald-950 text-emerald-300 border-emerald-900',
  Beast:      'bg-amber-950 text-amber-300 border-amber-900',
}

interface TypeBadgeProps {
  type: string
  size?: 'sm' | 'md'
}

export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const styles = TYPE_STYLES[type] ?? 'bg-stone-900 text-stone-400 border-stone-700'
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`${styles} ${sizeClasses} rounded border font-medium`}>
      {type}
    </span>
  )
}
