import { Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MusicScroll } from './MusicScroll'
import { useAppConfig } from '../config/ConfigProvider'

export function SavedTrackRow({ url, index }: { url: string, index: number }) {
  const cfg = useAppConfig()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionSec, setPositionSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setPositionSec(el.currentTime || 0)
    const onLoaded = () => setDurationSec(el.duration || 0)
    const onEnded = () => { setIsPlaying(false); setPositionSec(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('ended', onEnded)
    }
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) el.play().catch(() => setIsPlaying(false))
    else el.pause()
  }, [isPlaying])

  return (
    <div className="rounded-lg border border-orange-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setIsPlaying((v) => !v)}
          >
            {isPlaying ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <strong className="text-slate-900">Track {index + 1}</strong>
        </div>
        <a className="text-xs font-medium text-orange-700 hover:underline" href={url} target="_blank" rel="noreferrer">Open</a>
      </div>
      <div className="mt-3">
        <MusicScroll
          positionSec={positionSec}
          durationSec={durationSec}
          disabled={!durationSec}
          onSeek={(s) => { const el = audioRef.current; if (el) { el.currentTime = s; setPositionSec(s) } }}
        />
        <audio ref={audioRef} src={url} preload="metadata" />
      </div>
    </div>
  )
}


