type Props = {
  isPlaying: boolean
  disabled: boolean
  onPlayPause: () => void
  onSkip: (deltaSeconds: number) => void
  // Recording controls
  recordArmed: boolean
  isRecording: boolean
  recordingUrl: string | null
  onArm: () => void
  onDisarm: () => void
}

export function PlaybackControls({ isPlaying, disabled, onPlayPause, onSkip, recordArmed, isRecording, recordingUrl, onArm, onDisarm }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button onClick={recordArmed ? onDisarm : onArm} disabled={disabled} title={recordArmed ? 'Disarm recording' : 'Arm recording'}>
        {recordArmed ? 'Stop' : 'Record'}
      </button>
      {isRecording && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'red', display: 'inline-block' }} />
          <span>REC</span>
        </span>
      )}
      <button onClick={onPlayPause} disabled={disabled}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={() => onSkip(-5)} disabled={disabled}>-5s</button>
      <button onClick={() => onSkip(5)} disabled={disabled}>+5s</button>
      {recordingUrl && (
        <a href={recordingUrl} download={`mic-recording.wav`} style={{ marginLeft: 8 }}>Download Take</a>
      )}
    </div>
  )
}


