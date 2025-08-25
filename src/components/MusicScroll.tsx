import { memo } from 'react'

type MusicScrollProps = {
  positionSec: number
  durationSec: number
  disabled?: boolean
  onSeek: (seconds: number) => void
}

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds)) return '0:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const MusicScroll = memo(function MusicScroll({
  positionSec,
  durationSec,
  disabled,
  onSeek,
}: MusicScrollProps) {
  return (
    <div style={{ gridColumn: '1 / span 2' }}>
      <input
        type="range"
        min={0}
        max={durationSec || 0}
        step={0.01}
        value={positionSec}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{formatTime(positionSec)}</span>
        <span>{formatTime(durationSec || 0)}</span>
      </div>
    </div>
  )
})


