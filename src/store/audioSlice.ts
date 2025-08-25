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
}

export const selectFile = createAsyncThunk(
  'audio/selectFile',
  async (file: File | null, { rejectWithValue }) => {
    try {
      if (!file) return { durationSec: 0, bpm: null as number | null }
      const ctx = engineService.audioContext
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      engineService.player.setBuffer(decoded)
      engineService.player.setMediaFile(file)
      const bpm = await detectBpmFromAudioBuffer(decoded)
      engineService.metronome.setBpm(bpm)
      return { durationSec: decoded.duration, bpm: Math.round(bpm) }
    } catch (e) {
      return rejectWithValue((e as Error).message || 'Failed to process file')
    }
  }
)

export const playPause = createAsyncThunk('audio/playPause', async (_, { getState }) => {
  const state = (getState() as { audio: AudioState }).audio
  const ctx = engineService.audioContext
  if (!state.isPlaying) {
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
    return { isPlaying: true }
  } else {
    engineService.metronome.stop()
    engineService.player.stop()
    return { isPlaying: false }
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
      .addCase(playPause.fulfilled, (state, action) => {
        state.isPlaying = action.payload.isPlaying
      })
      .addCase(seekTo.fulfilled, (state, action) => {
        state.positionSec = action.payload.positionSec
        state.isPlaying = action.payload.isPlaying
      })
      .addCase(skip.fulfilled, () => {})
  },
})

export const { setTrackVolume, setMetroVolume, setPositionSec } = audioSlice.actions
export default audioSlice.reducer


