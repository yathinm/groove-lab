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
      engineService.player.setBuffer(decoded)
      engineService.player.setMediaFile(file)
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
      // Decode and store the recorded WAV as a new track in-app
      // Fire-and-forget to avoid delaying UI update
      void engineService.addTrackFromBlob(stopped.wavBlob)
        .then((buf) => { /* eslint-disable-next-line no-console */ console.log('[AUDIO] decoded WAV added as track', { duration: buf.duration }) })
        .catch((e) => { /* eslint-disable-next-line no-console */ console.error('[AUDIO] failed to decode/add recorded WAV', e) })
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
    if ((engineService.player as unknown as any).hasMedia?.()) {
      ;(engineService.player as unknown as any).playMediaAt(state.positionSec)
      const startAt = ctx.currentTime + 0.02
      if (state.bpm) engineService.metronome.setBpm(state.bpm)
      engineService.metronome.startAt(startAt)
    } else {
      const startAt = ctx.currentTime + 0.03
      engineService.player.playAt(startAt, state.positionSec)
      if (state.bpm) engineService.metronome.setBpm(state.bpm)
      engineService.metronome.startAt(startAt)
    }
    let startedRecording = false
    if (state.recordArmed && !engineService.recorder.recording) {
      try { engineService.recorder.start(); startedRecording = true } catch {}
    }
    return { isPlaying: true, startedRecording }
  } else {
    // eslint-disable-next-line no-console
    console.log('[AUDIO] playPause -> pause')
    engineService.metronome.stop()
    engineService.player.stop()
    const stopped = engineService.recorder.stop()
    if (stopped) {
      // Fire-and-forget so UI updates immediately with blob URL
      void engineService.addTrackFromBlob(stopped.wavBlob)
        .then(() => { /* eslint-disable-next-line no-console */ console.log('[AUDIO] appended recorded track on pause') })
        .catch(() => {})
    }
    return { isPlaying: false, recordingUrl: stopped?.wavUrl ?? null, recordingMp3Url: stopped?.mp3Url ?? null }
  }
})

export const seekTo = createAsyncThunk('audio/seekTo', async (seconds: number, { getState }) => {
  const state = (getState() as { audio: AudioState }).audio
  const ctx = engineService.audioContext
  const dur = engineService.player.getDurationSeconds()
  const clamped = Math.max(0, Math.min(seconds, dur))
  engineService.metronome.stop()
  engineService.player.stop()
  if (ctx.state === 'suspended') await ctx.resume()
  if ((engineService.player as unknown as any).hasMedia?.()) {
    ;(engineService.player as unknown as any).playMediaAt(clamped)
  } else {
    engineService.player.playImmediate(clamped)
  }
  if (state.bpm) engineService.metronome.setBpm(state.bpm)
  const startAt = ctx.currentTime + 0.02
  engineService.metronome.startAt(startAt)
  return { positionSec: clamped, isPlaying: true }
})

export const skip = createAsyncThunk('audio/skip', async (deltaSeconds: number) => {
  return deltaSeconds
})

const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setTrackVolume(state, action: PayloadAction<number>) {
      state.trackVolume = action.payload
      engineService.player.setVolume(action.payload)
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
      })
      .addCase(seekTo.fulfilled, (state, action) => {
        state.positionSec = action.payload.positionSec
        state.isPlaying = action.payload.isPlaying
      })
      .addCase(skip.fulfilled, () => {})
  },
})

export const { setTrackVolume, setMetroVolume, setPositionSec, setRecordArmed, setRecordingUrl } = audioSlice.actions
export default audioSlice.reducer


