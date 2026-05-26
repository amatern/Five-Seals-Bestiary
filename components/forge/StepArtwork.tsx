'use client'

import { useRef, useState } from 'react'

interface StepArtworkProps {
  concept: string
  artworkUrl: string | null
  onArtwork: (url: string) => void
  onNext: () => void
  onBack: () => void
}

export function StepArtwork({ concept, artworkUrl, onArtwork, onNext, onBack }: StepArtworkProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleGenerate() {
    setIsGenerating(true)
    setLocalError(null)
    try {
      const res = await fetch('/api/forge/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept }),
      })
      if (!res.ok) throw new Error('generation-failed')
      const { url } = await res.json()
      onArtwork(url)
    } catch {
      setLocalError('The Forge did not answer. Try again when the flame is steadier.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    setLocalError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/forge/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'upload-failed')
      }
      const { url } = await res.json()
      onArtwork(url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'upload-failed'
      setLocalError(msg === 'upload-failed' || msg.includes('failed')
        ? 'The chronicler could not record this. Try again.'
        : msg)
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const isBusy = isGenerating || isUploading

  return (
    <div>
      <h2 className="text-stone-400 text-xs uppercase tracking-widest mb-6">Artwork</h2>

      {artworkUrl && (
        <div className="mb-6 flex justify-center">
          <img
            src={artworkUrl}
            alt="Creature artwork"
            className="w-full max-w-xs rounded border border-stone-800 object-cover"
          />
        </div>
      )}

      {localError && (
        <p className="text-red-400 text-sm italic mb-4">{localError}</p>
      )}

      <div className="space-y-3 mb-8">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isBusy}
          className="w-full py-3 border border-stone-700 text-stone-300 text-sm rounded hover:border-stone-500 hover:text-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGenerating
            ? 'The Forge burns...'
            : artworkUrl
            ? 'Regenerate with AI'
            : 'Generate with AI'}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isBusy}
          className="w-full py-3 border border-stone-700 text-stone-300 text-sm rounded hover:border-stone-500 hover:text-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : 'Upload image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-stone-500 text-sm hover:text-stone-300 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isBusy}
          className="flex-1 py-2 bg-stone-100 text-stone-950 text-sm font-medium rounded hover:bg-white transition-colors disabled:opacity-40"
        >
          {artworkUrl ? 'Continue →' : 'Skip artwork →'}
        </button>
      </div>
    </div>
  )
}
