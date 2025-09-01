import { Upload } from 'lucide-react'
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
      <div className="group flex items-center justify-between rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-6 transition-colors hover:bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Upload className="h-4 w-4 text-gray-700" /> <span className="text-gray-700">Drag & drop your file here, or choose a file</span>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500">
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


