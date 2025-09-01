// Keep native input range; only add icons elsewhere if needed
type Props = {
  trackVolume: number
  metroVolume: number
  onTrackVolume: (v: number) => void
  onMetroVolume: (v: number) => void
}

export function VolumeControls({ trackVolume, metroVolume, onTrackVolume, onMetroVolume }: Props) {
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Track Volume</label>
        <input
          className="w-full accent-orange-600"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={trackVolume}
          onChange={(e) => onTrackVolume(parseFloat(e.target.value))}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Metronome Volume</label>
        <input
          className="w-full accent-orange-600"
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


