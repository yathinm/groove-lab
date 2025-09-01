import { Play, Square, Mic } from 'lucide-react'
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
    <div className="flex items-center gap-3">
      <button
        className="inline-flex items-center rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => { /* eslint-disable-next-line no-console */ console.log('[UI] record button clicked', { recordArmed }); (recordArmed ? onDisarm : onArm)() }}
        disabled={disabled}
        title={recordArmed ? 'Disarm recording' : 'Arm recording'}
      >
        <Mic className="mr-2 h-4 w-4" />
        {recordArmed ? 'Stop' : 'Record'}
      </button>
      {isRecording && (
        <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
          <span>REC</span>
        </span>
      )}
      <button
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => { /* eslint-disable-next-line no-console */ console.log('[UI] play/pause clicked', { isPlaying }); onPlayPause() }}
        disabled={disabled}
      >
        {isPlaying ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  )
}


