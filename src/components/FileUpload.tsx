type Props = {
  disabled: boolean
  processing: boolean
  error: string | null
  onSelect: (file: File | null) => void
}

export function FileUpload({ disabled, processing, error, onSelect }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <label className="text-sm font-medium text-slate-200" htmlFor="file">Upload audio (.mp3, .wav)</label>
      <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/40 px-4 py-6 hover:bg-slate-800/60">
        <div className="text-sm text-slate-300">Drag & drop your file here, or choose a file</div>
        <label className="inline-flex cursor-pointer items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
          Browse
          <input
            id="file"
            type="file"
            className="sr-only"
            accept="audio/mpeg, audio/wav, .mp3, .wav, audio/*"
            disabled={disabled}
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {processing && <p className="text-sm text-indigo-600">Processing...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}


