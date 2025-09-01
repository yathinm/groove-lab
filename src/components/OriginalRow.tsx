import { Play, Square } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../store'
import { engineService } from '../store/engineService'
import { pausePlayback, playModeOnly } from '../store/audioSlice'

export function OriginalRow() {
  const dispatch = useDispatch()
  const { isPlaying, playingMode } = useSelector((s: RootState) => s.audio)
  const hasOriginal = !!engineService.getOriginalTrack()
  const isPlayingThis = isPlaying && playingMode === 'original'

  const onClick = async () => {
    if (isPlayingThis) {
      await dispatch(pausePlayback() as any)
      return
    }
    await dispatch(playModeOnly('original') as any)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-white p-3">
      <button
        className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onClick}
        disabled={!hasOriginal}
        data-mode="original"
      >
        {isPlayingThis ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
        {isPlayingThis ? 'Pause' : 'Play'}
      </button>
      <strong className="min-w-[100px] text-white">Original</strong>
      <span className="text-xs text-slate-300">{!hasOriginal ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
    </div>
  )
}


