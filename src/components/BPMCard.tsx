type Props = { bpm: number | null; processing: boolean }

export function BPMCard({ bpm, processing }: Props) {
  return (
    <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 8, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: '#666' }}>Detected BPM</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{bpm ?? (processing ? '…' : '-')}</div>
    </div>
  )
}


