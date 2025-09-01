type Props = { bpm: number | null; processing: boolean }

export function BPMCard({ bpm, processing }: Props) {
  return (
    <div className="min-w-[120px] rounded-xl bg-gradient-to-br from-teal-50 to-sky-100 p-4 ring-1 ring-inset ring-teal-200">
      <div className="text-xs font-medium text-teal-700">Detected BPM</div>
      <div className="mt-1 text-3xl font-bold text-teal-900">{bpm ?? (processing ? '…' : '-')}</div>
    </div>
  )
}


