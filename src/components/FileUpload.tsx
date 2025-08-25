type Props = {
  disabled: boolean
  processing: boolean
  error: string | null
  onSelect: (file: File | null) => void
}

export function FileUpload({ disabled, processing, error, onSelect }: Props) {
  return (
    <section>
      <label htmlFor="file">Upload audio (.mp3, .wav)</label>
      <input
        id="file"
        type="file"
        accept="audio/mpeg, audio/wav, .mp3, .wav, audio/*"
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {processing && <p>Processing...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </section>
  )
}


