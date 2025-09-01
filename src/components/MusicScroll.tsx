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
    <div className="col-span-2">
      <input
        className="w-full accent-teal-600"
        type="range"
        min={0}
        max={durationSec || 0}
        step={0.01}
        value={positionSec}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        disabled={disabled}
      />
      <div className="mt-2 flex justify-between font-mono text-xs text-gray-600">
        <span>{formatTime(positionSec)}</span>
        <span>{formatTime(durationSec || 0)}</span>
      </div>
    </div>
  )
})


