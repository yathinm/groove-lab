type Props = { bpm: number | null; processing: boolean }

export function BPMCard({ bpm, processing }: Props) {
  return (
    <div className="min-w-[120px] rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 ring-1 ring-inset ring-amber-200">
      <div className="text-xs font-medium text-amber-700">Detected BPM</div>
      <div className="mt-1 text-3xl font-bold text-amber-900">{bpm ?? (processing ? '…' : '-')}</div>
    </div>
  )
}


