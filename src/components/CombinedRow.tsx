import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../store'
import { engineService } from '../store/engineService'
import { pausePlayback, playModeOnly } from '../store/audioSlice'

export function CombinedRow() {
  const dispatch = useDispatch()
  const { isPlaying, playingMode } = useSelector((s: RootState) => s.audio)
  const hasAny = !!engineService.getOriginalTrack() || !!engineService.getLatestRecordingTrack()
  const isPlayingThis = isPlaying && playingMode === 'combined'

  const onClick = async () => {
    if (isPlayingThis) {
      await dispatch(pausePlayback() as any)
      return
    }
    await dispatch(playModeOnly('combined') as any)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onClick} disabled={!hasAny} data-mode="combined">
        {isPlayingThis ? 'Pause' : 'Play'}
      </button>
      <strong style={{ minWidth: 100 }}>Combined</strong>
      <span style={{ opacity: 0.8, fontSize: 12 }}>{!hasAny ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
    </div>
  )
}


