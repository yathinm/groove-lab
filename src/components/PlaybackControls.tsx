type Props = {
  isPlaying: boolean
  disabled: boolean
  onPlayPause: () => void
  onSkip: (deltaSeconds: number) => void
  // Recording controls
  recordArmed: boolean
  isRecording: boolean
  recordingUrl: string | null
  recordingMp3Url?: string | null
  onArm: () => void
  onDisarm: () => void
}

export function PlaybackControls({ isPlaying, disabled, onPlayPause, onSkip, recordArmed, isRecording, recordingUrl, recordingMp3Url, onArm, onDisarm }: Props) {
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
        <button onClick={() => { if (recordingUrl) window.open(recordingUrl, '_blank') }} style={{ marginLeft: 8 }}>Save WAV</button>
      )}
      {recordingMp3Url && (
        <>
          <button onClick={() => { if (recordingMp3Url) window.open(recordingMp3Url, '_blank') }} style={{ marginLeft: 8 }}>Save MP3</button>
          <audio src={recordingMp3Url} controls style={{ marginLeft: 8 }} />
        </>
      )}
    </div>
  )
}


