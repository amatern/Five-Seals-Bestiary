import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-8">
      <p className="text-stone-400 text-lg mb-2">The chronicle holds no record of this creature.</p>
      <p className="text-stone-600 text-sm italic mb-8">
        It may never have existed, or has been unmade.
      </p>
      <Link
        href="/bestiary"
        className="text-stone-500 text-sm hover:text-stone-300 transition-colors"
      >
        ← Return to the Bestiary
      </Link>
    </main>
  )
}
