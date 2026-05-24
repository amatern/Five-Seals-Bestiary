import type { Metadata } from 'next'
import { Crimson_Pro } from 'next/font/google'
import './globals.css'

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-crimson',
})

export const metadata: Metadata = {
  title: 'Five Seals Bestiary',
  description: 'The chronicler records what walks in the dark.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={crimsonPro.variable}>
      <body className="bg-stone-950 text-stone-100 antialiased font-serif">
        {children}
      </body>
    </html>
  )
}
