'use client'

import { useEffect, useRef } from 'react'

interface Props {
  entries: string[]
}

export function ChronicleLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 h-32 overflow-y-auto">
      {entries.length === 0 ? (
        <p className="text-stone-700 text-xs italic">The battle begins.</p>
      ) : (
        entries.map((entry, i) => (
          <p
            key={i}
            className={`text-xs italic mb-1 ${i === entries.length - 1 ? 'text-stone-400' : 'text-stone-600'}`}
          >
            {entry}
          </p>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
