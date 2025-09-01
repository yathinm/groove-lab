import { Upload } from 'lucide-react'
import { useAppConfig } from '../config/ConfigProvider'
type Props = {
  disabled: boolean
  error: string | null
  onSelect: (file: File | null) => void
}

export function FileUpload({ disabled, error, onSelect }: Props) {
  const cfg = useAppConfig()
  return (
    <section className="flex flex-col gap-3">
      <div className="group flex flex-col gap-4 rounded-2xl border-2 border-dashed border-orange-300 bg-white px-6 py-8 text-center transition-colors hover:border-orange-400 hover:bg-orange-50 sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Upload className="h-6 w-6 text-orange-600" />
          <div>
            <div className="text-sm font-medium text-gray-800">Drag & drop your file here</div>
            <div className="text-xs text-gray-600">or click Browse to select from your device</div>
            <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
              {cfg.upload.allowedLabels.map((label) => (
                <span key={label} className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200">{label}</span>
              ))}
            </div>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center self-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:self-auto">
          Browse
          <input
            id="file"
            type="file"
            className="sr-only"
            accept={cfg.upload.accept}
            disabled={disabled}
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {/* removed in favor of cleaner upload UI */}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}


