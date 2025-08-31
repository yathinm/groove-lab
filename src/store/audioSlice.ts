import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { engineService } from './engineService'
import { detectBpmFromAudioBuffer } from '../audio/bpm'

export type AudioState = {
  isPlaying: boolean
  processing: boolean
  error: string | null
  bpm: number | null
  positionSec: number
  durationSec: number
  trackVolume: number
  metroVolume: number
  // Recording
  recordArmed: boolean
  isRecording: boolean
  recordingUrl: string | null
  recordingMp3Url: string | null
  // Playback mode: 'original' only, 'recording' only, or 'combined'
  playMode: 'original' | 'recording' | 'combined'
  // Which mode is currently playing (null when paused)
  playingMode: 'original' | 'recording' | 'combined' | null
}

const initialState: AudioState = {
  isPlaying: false,
  processing: false,
  error: null,
  bpm: null,
  positionSec: 0,
  durationSec: 0,
  trackVolume: 0.9,
  metroVolume: 0.7,
  recordArmed: false,
  isRecording: false,
  recordingUrl: null,
  recordingMp3Url: null,
  playMode: 'combined',
  playingMode: null,
}

export const selectFile = createAsyncThunk(
  'audio/selectFile',
  async (file: File | null, { rejectWithValue }) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[AUDIO] selectFile', { hasFile: !!file, name: file?.name })
      if (!file) return { durationSec: 0, bpm: null as number | null }
      const ctx = engineService.audioContext
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      // Use decoded buffer as track 0 in multi-track engine
      engineService.player.setBuffer(decoded)
      // Disable HTMLMediaElement path in favor of buffer-based multi-track
      // Seed tracks with the original song buffer
      engineService.resetTracks()
      engineService.addTrack(decoded)
      const bpm = await detectBpmFromAudioBuffer(decoded)
      engineService.metronome.setBpm(bpm)
      // eslint-disable-next-line no-console
      console.log('[AUDIO] selectFile complete', { duration: decoded.duration, bpm })
      return { durationSec: decoded.duration, bpm: Math.round(bpm) }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AUDIO] selectFile error', e)
      return rejectWithValue((e as Error).message || 'Failed to process file')
    }
  }
)

export const armRecording = createAsyncThunk(
  'audio/armRecording',
  async (_, { getState, rejectWithValue }) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[AUDIO] armRecording dispatch')
      await engineService.recorder.arm()
      let startedRecording = false
      const state = (getState() as { audio: AudioState }).audio
      if (state.isPlaying && !engineService.recorder.recording) {
        try { engineService.recorder.start(); startedRecording = true } catch {}
      }
      // eslint-disable-next-line no-console
      console.log('[AUDIO] armRecording success', { startedRecording, isPlaying: state.isPlaying })
      return { armed: true, startedRecording }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AUDIO] armRecording error', e)
      return rejectWithValue((e as Error).message || 'Microphone access denied')
    }
  }
)

export const disarmRecording = createAsyncThunk('audio/disarmRecording', async () => {
  // eslint-disable-next-line no-console
  console.log('[AUDIO] disarmRecording dispatch')
  let recordingUrl: string | null = null
  let recordingMp3Url: string | null = null
  try {
    const stopped = engineService.recorder.stop()
    if (stopped) {
      // eslint-disable-next-line no-console
      console.log('[AUDIO] recorder.stop() returned', { hasWav: !!stopped.wavBlob, wavSize: stopped.wavBlob.size, hasMp3: !!stopped.mp3Blob })
      recordingUrl = stopped.wavUrl
      recordingMp3Url = stopped.mp3Url ?? null
      // Decode and store the recorded WAV as a new track in-app (await so duration can update)
      try {
        const buf = await engineService.addTrackFromBlob(stopped.wavBlob)
        // eslint-disable-next-line no-console
        console.log('[AUDIO] decoded WAV added as track', { duration: buf.duration })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[AUDIO] failed to decode/add recorded WAV', e)
      }
    }
  } catch {}
  try {
    engineService.recorder.disarm()
  } catch {}
  // eslint-disable-next-line no-console
  console.log('[AUDIO] disarmRecording done', { recordingUrl, recordingMp3Url })
  return { armed: false, recordingUrl, recordingMp3Url }
})

export const playPause = createAsyncThunk('audio/playPause', async (_, { getState }) => {
  const state = (getState() as { audio: AudioState }).audio
  const ctx = engineService.audioContext
  if (!state.isPlaying) {
    // eslint-disable-next-line no-console
    console.log('[AUDIO] playPause -> play', { positionSec: state.positionSec, recordArmed: state.recordArmed })
    if (ctx.state === 'suspended') await ctx.resume()
    const startAt = ctx.currentTime + 0.03
    // Decide which buffers to play based on current/selected mode
    const mode = state.playingMode ?? state.playMode
    const buffers = engineService.getBuffersForMode(mode)
    if (buffers.length === 0) return { isPlaying: false }
    // Reset position to start when playing
    const startOffset = 0
    engineService.playBuffersAt(startAt, startOffset, buffers, mode)
    if (state.bpm) engineService.metronome.setBpm(state.bpm)
    engineService.metronome.startAt(startAt)
    let startedRecording = false
    if (state.recordArmed && !engineService.recorder.recording) {
      try { engineService.recorder.start(); startedRecording = true } catch {}
    }
    return { isPlaying: true, startedRecording, positionSec: startOffset, playingMode: mode }
  } else {
    // eslint-disable-next-line no-console
    console.log('[AUDIO] playPause -> pause')
    engineService.metronome.stop()
    engineService.stopAll()
    const stopped = engineService.recorder.stop()
    if (stopped) {
      // Fire-and-forget so UI updates immediately with blob URL
      void engineService.addTrackFromBlob(stopped.wavBlob)
        .then(() => { /* eslint-disable-next-line no-console */ console.log('[AUDIO] appended recorded track on pause') })
        .catch(() => {})
    }
    return { isPlaying: false, recordingUrl: stopped?.wavUrl ?? null, recordingMp3Url: stopped?.mp3Url ?? null, playingMode: null }
  }
})

export const seekTo = createAsyncThunk('audio/seekTo', async (seconds: number, { getState }) => {
  const state = (getState() as { audio: AudioState }).audio
  const ctx = engineService.audioContext
  const mode = engineService.getCurrentMode() ?? state.playingMode ?? state.playMode
  const dur = engineService.getDurationForMode(mode) || engineService.player.getDurationSeconds()
  const clamped = Math.max(0, Math.min(seconds, dur))
  engineService.metronome.stop()
  engineService.stopAll()
  if (ctx.state === 'suspended') await ctx.resume()
  const buffers = engineService.getBuffersForMode(mode)
  if (buffers.length > 0) {
    engineService.playBuffersImmediate(clamped, buffers)
  }
  if (state.bpm) engineService.metronome.setBpm(state.bpm)
  const startAt = ctx.currentTime + 0.02
  engineService.metronome.startAt(startAt)
  return { positionSec: clamped, isPlaying: true, playingMode: mode }
})

export const skip = createAsyncThunk('audio/skip', async (deltaSeconds: number) => {
  return deltaSeconds
})

// Play a specific mode WITHOUT metronome or recording side-effects
export const playModeOnly = createAsyncThunk('audio/playModeOnly', async (mode: 'original' | 'recording' | 'combined', { getState }) => {
  const state = (getState() as { audio: AudioState }).audio
  const ctx = engineService.audioContext
  if (ctx.state === 'suspended') await ctx.resume()
  engineService.metronome.stop()
  const buffers = engineService.getBuffersForMode(mode)
  if (buffers.length === 0) return { isPlaying: false }
  const startAt = ctx.currentTime + 0.02
  const startOffset = 0
  // eslint-disable-next-line no-console
  console.log('[THUNK] playModeOnly', { mode, buffers: buffers.length })
  engineService.playBuffersAt(startAt, startOffset, buffers, mode)
  return { isPlaying: true, positionSec: startOffset, playingMode: mode, playMode: mode }
})

// Pause playback WITHOUT metronome or recording side-effects
export const pausePlayback = createAsyncThunk('audio/pausePlayback', async () => {
  // eslint-disable-next-line no-console
  console.log('[THUNK] pausePlayback')
  try { engineService.stopAll() } catch {}
  engineService.metronome.stop()
  return { isPlaying: false, playingMode: null }
})

// Single toggle that rows can use: switches to mode if not playing it; otherwise pauses. No metronome.
export const toggleMode = createAsyncThunk('audio/toggleMode', async (mode: 'original' | 'recording' | 'combined') => {
  const ctx = engineService.audioContext
  // eslint-disable-next-line no-console
  console.log('[THUNK] toggleMode', { mode, enginePlaying: engineService.isAnyPlaying(), engineMode: engineService.getCurrentMode() })
  if (engineService.isAnyPlaying() && engineService.getCurrentMode() === mode) {
    try { engineService.stopAll() } catch {}
    return { isPlaying: false, playingMode: null }
  }
  const buffers = engineService.getBuffersForMode(mode)
  if (buffers.length === 0) return { isPlaying: false, playingMode: null }
  if (ctx.state === 'suspended') await ctx.resume()
  try { engineService.stopAll() } catch {}
  const startAt = ctx.currentTime + 0.02
  const startOffset = 0
  engineService.playBuffersAt(startAt, startOffset, buffers, mode)
  return { isPlaying: true, playingMode: mode, positionSec: startOffset }
})

const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setTrackVolume(state, action: PayloadAction<number>) {
      state.trackVolume = action.payload
      engineService.player.setVolume(action.payload)
    },
    setPlayMode(state, action: PayloadAction<'original' | 'recording' | 'combined'>) {
      state.playMode = action.payload
      // Update duration to reflect mode
      state.durationSec = engineService.getDurationForMode(action.payload)
    },
    setMetroVolume(state, action: PayloadAction<number>) {
      state.metroVolume = action.payload
      engineService.metronome.setVolume(action.payload)
    },
    setPositionSec(state, action: PayloadAction<number>) {
      state.positionSec = action.payload
    },
    setRecordArmed(state, action: PayloadAction<boolean>) {
      state.recordArmed = action.payload
    },
    setRecordingUrl(state, action: PayloadAction<string | null>) {
      state.recordingUrl = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(selectFile.pending, (state) => {
        state.processing = true
        state.error = null
      })
      .addCase(selectFile.fulfilled, (state, action) => {
        state.processing = false
        state.durationSec = action.payload.durationSec
        state.bpm = action.payload.bpm
        state.positionSec = 0
      })
      .addCase(selectFile.rejected, (state, action) => {
        state.processing = false
        state.error = (action.payload as string) || 'Failed to process file'
      })
      .addCase(armRecording.fulfilled, (state, action) => {
        state.recordArmed = true
        state.error = null
        if ('startedRecording' in action.payload) {
          state.isRecording = !!(action.payload as any).startedRecording
        }
      })
      .addCase(armRecording.rejected, (state, action) => {
        state.recordArmed = false
        state.error = (action.payload as string) || 'Microphone access denied'
      })
      .addCase(disarmRecording.fulfilled, (state, action) => {
        state.recordArmed = false
        state.isRecording = false
        if (action.payload.recordingUrl) state.recordingUrl = action.payload.recordingUrl
        if (action.payload.recordingMp3Url) state.recordingMp3Url = action.payload.recordingMp3Url
      })
      .addCase(playPause.fulfilled, (state, action) => {
        state.isPlaying = action.payload.isPlaying
        if ('startedRecording' in action.payload) {
          state.isRecording = !!action.payload.startedRecording
        }
        if ('recordingUrl' in action.payload) {
          state.isRecording = false
          state.recordingUrl = action.payload.recordingUrl || state.recordingUrl
          state.recordingMp3Url = action.payload.recordingMp3Url || state.recordingMp3Url
        }
        if ('positionSec' in action.payload) {
          state.positionSec = (action.payload as any).positionSec
        }
        if ('playingMode' in action.payload) {
          state.playingMode = (action.payload as any).playingMode
        }
      })
      .addCase(seekTo.fulfilled, (state, action) => {
        state.positionSec = action.payload.positionSec
        state.isPlaying = action.payload.isPlaying
        if ('playingMode' in action.payload) state.playingMode = (action.payload as any).playingMode
      })
      .addCase(skip.fulfilled, () => {})
      .addCase(playModeOnly.fulfilled, (state, action) => {
        state.isPlaying = action.payload.isPlaying
        if ('positionSec' in action.payload) state.positionSec = (action.payload as any).positionSec
        state.playingMode = (action.payload as any).playingMode ?? state.playingMode
        if ((action.payload as any).playMode) state.playMode = (action.payload as any).playMode
      })
      .addCase(pausePlayback.fulfilled, (state, action) => {
        state.isPlaying = action.payload.isPlaying
        state.playingMode = (action.payload as any).playingMode
      })
      .addCase(toggleMode.fulfilled, (state, action) => {
        state.isPlaying = action.payload.isPlaying
        state.playingMode = (action.payload as any).playingMode
        if ('positionSec' in action.payload) state.positionSec = (action.payload as any).positionSec
        // Keep selected playMode in sync when toggling to a mode
        if (action.payload.isPlaying && (action.payload as any).playingMode) {
          state.playMode = (action.payload as any).playingMode
        }
      })
  },
})

export const { setTrackVolume, setMetroVolume, setPositionSec, setRecordArmed, setRecordingUrl, setPlayMode } = audioSlice.actions
export default audioSlice.reducer


