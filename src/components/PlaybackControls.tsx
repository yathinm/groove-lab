type Props = {
  isPlaying: boolean
  disabled: boolean
  onPlayPause: () => void
  onSkip: (deltaSeconds: number) => void
}

export function PlaybackControls({ isPlaying, disabled, onPlayPause, onSkip }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button onClick={onPlayPause} disabled={disabled}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={() => onSkip(-5)} disabled={disabled}>-5s</button>
      <button onClick={() => onSkip(5)} disabled={disabled}>+5s</button>
    </div>
  )
}


