type Props = {
  isPlaying: boolean
  disabled: boolean
  onPlayPause: () => void
  // Recording controls
  recordArmed: boolean
  isRecording: boolean
  onArm: () => void
  onDisarm: () => void
}

export function PlaybackControls({ isPlaying, disabled, onPlayPause, recordArmed, isRecording, onArm, onDisarm }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button onClick={() => { /* eslint-disable-next-line no-console */ console.log('[UI] record button clicked', { recordArmed }); (recordArmed ? onDisarm : onArm)() }} disabled={disabled} title={recordArmed ? 'Disarm recording' : 'Arm recording'}>
        {recordArmed ? 'Stop' : 'Record'}
      </button>
      {isRecording && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'red', display: 'inline-block' }} />
          <span>REC</span>
        </span>
      )}
      <button onClick={() => { /* eslint-disable-next-line no-console */ console.log('[UI] play/pause clicked', { isPlaying }); onPlayPause() }} disabled={disabled}>{isPlaying ? 'Pause' : 'Play'}</button>
      {/* In unified workspace, we keep recordings in-app; remove external open/save buttons */}
    </div>
  )
}


