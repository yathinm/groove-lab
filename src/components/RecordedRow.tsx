import { Play, Square } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../store'
import { engineService } from '../store/engineService'
import { pausePlayback, playModeOnly } from '../store/audioSlice'

export function RecordedRow() {
  const dispatch = useDispatch()
  const { isPlaying, playingMode } = useSelector((s: RootState) => s.audio)
  const hasRecording = !!engineService.getLatestRecordingTrack()
  const isPlayingThis = isPlaying && playingMode === 'recording'

  const onClick = async () => {
    if (isPlayingThis) {
      await dispatch(pausePlayback() as any)
      return
    }
    await dispatch(playModeOnly('recording') as any)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-white p-3">
      <button
        className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onClick}
        disabled={!hasRecording}
        data-mode="recording"
      >
        {isPlayingThis ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
        {isPlayingThis ? 'Pause' : 'Play'}
      </button>
      <div className="flex-1 min-w-0">
        <strong className="text-slate-900">Recorded</strong>
        <span className="ml-2 text-xs text-slate-600">{!hasRecording ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
      </div>
    </div>
  )
}


