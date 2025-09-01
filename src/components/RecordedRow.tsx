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
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <button
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onClick}
        disabled={!hasRecording}
        data-mode="recording"
      >
        {isPlayingThis ? 'Pause' : 'Play'}
      </button>
      <strong className="min-w-[100px] text-gray-900">Recorded</strong>
      <span className="text-xs text-gray-600">{!hasRecording ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
    </div>
  )
}


