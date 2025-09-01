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
  const progressPercent = durationSec > 0 ? Math.min(100, Math.max(0, (positionSec / durationSec) * 100)) : 0
  const segments = [0, 25, 50, 75, 100]

  return (
    <div className="col-span-2">
      <div className="group relative">
        {/* Track */}
        <div className="h-2 rounded-full bg-gray-200 transition-all group-hover:h-3">
          {/* Progress fill */}
          <div
            className="h-full rounded-full bg-orange-500 transition-[width] duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Segment ticks */}
        <div className="pointer-events-none absolute inset-0">
          {durationSec > 0 && segments.map((s) => (
            <div
              key={s}
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-orange-200"
              style={{ left: `${s}%` }}
            />
          ))}
        </div>

        {/* Invisible range captures interaction */}
        <input
          aria-label="Timeline position"
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          type="range"
          min={0}
          max={durationSec || 0}
          step={0.01}
          value={positionSec}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          disabled={disabled}
        />

        {/* Thumb indicator */}
        <div
          className="pointer-events-none absolute top-1/2 -mt-2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-orange-500 shadow group-hover:scale-110"
          style={{ left: `calc(${progressPercent}% - 0.5rem)` }}
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-xs text-gray-600">
        <span className="inline-flex items-center rounded bg-orange-50 px-1.5 py-0.5 text-orange-700 ring-1 ring-inset ring-orange-200">
          {formatTime(positionSec)}
        </span>
        <span className="inline-flex items-center rounded bg-gray-50 px-1.5 py-0.5 text-gray-700 ring-1 ring-inset ring-gray-200">
          {formatTime(durationSec || 0)}
        </span>
      </div>
    </div>
  )
})


