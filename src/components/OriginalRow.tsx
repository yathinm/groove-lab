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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onClick} disabled={!hasOriginal} data-mode="original">
        {isPlayingThis ? 'Pause' : 'Play'}
      </button>
      <strong style={{ minWidth: 100 }}>Original</strong>
      <span style={{ opacity: 0.8, fontSize: 12 }}>{!hasOriginal ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
    </div>
  )
}


