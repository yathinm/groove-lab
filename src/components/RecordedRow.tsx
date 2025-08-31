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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onClick} disabled={!hasRecording} data-mode="recording">
        {isPlayingThis ? 'Pause' : 'Play'}
      </button>
      <strong style={{ minWidth: 100 }}>Recorded</strong>
      <span style={{ opacity: 0.8, fontSize: 12 }}>{!hasRecording ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
    </div>
  )
}


