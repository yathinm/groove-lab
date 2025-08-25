type Props = {
  trackVolume: number
  metroVolume: number
  onTrackVolume: (v: number) => void
  onMetroVolume: (v: number) => void
}

export function VolumeControls({ trackVolume, metroVolume, onTrackVolume, onMetroVolume }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 560 }}>
      <div>
        <label>Track Volume</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={trackVolume}
          onChange={(e) => onTrackVolume(parseFloat(e.target.value))}
        />
      </div>
      <div>
        <label>Metronome Volume</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metroVolume}
          onChange={(e) => onMetroVolume(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}


