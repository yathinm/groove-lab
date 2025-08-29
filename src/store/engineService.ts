import { createAudioContext } from '../audio/createAudioContext'
import { AudioPlayer } from '../audio/player'
import { Metronome } from '../audio/metronome'
import { MicrophoneRecorder } from '../audio/recorder'

class EngineService {
  private ctx: AudioContext
  readonly player: AudioPlayer
  readonly metronome: Metronome
  readonly recorder: MicrophoneRecorder
  private tracks: AudioBuffer[] = []
  private activeSources: AudioBufferSourceNode[] = []
  private playbackStartCtxTime: number | null = null
  private playbackStartOffsetSec: number = 0
  private currentMode: 'original' | 'recording' | 'combined' | null = null

  constructor() {
    this.ctx = createAudioContext()
    this.player = new AudioPlayer(this.ctx)
    this.metronome = new Metronome(this.ctx)
    this.recorder = new MicrophoneRecorder(this.ctx)
  }

  get audioContext(): AudioContext {
    return this.ctx
  }

  getPositionSec(): number {
    if (this.playbackStartCtxTime != null) {
      const elapsed = Math.max(0, this.ctx.currentTime - this.playbackStartCtxTime)
      return this.playbackStartOffsetSec + elapsed
    }
    return this.player.getPlaybackOffsetSeconds(this.ctx.currentTime)
  }

  // Tracks management
  resetTracks(): void {
    this.tracks = []
  }

  addTrack(buffer: AudioBuffer): void {
    this.tracks.push(buffer)
  }

  getTracks(): ReadonlyArray<AudioBuffer> {
    return this.tracks
  }

  async decodeFromBlobAsAudioBuffer(blob: Blob): Promise<AudioBuffer> {
    const objectUrl = URL.createObjectURL(blob)
    try {
      const response = await fetch(objectUrl)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
      return audioBuffer
    } finally {
      try { URL.revokeObjectURL(objectUrl) } catch {}
    }
  }

  async addTrackFromBlob(blob: Blob): Promise<AudioBuffer> {
    const audioBuffer = await this.decodeFromBlobAsAudioBuffer(blob)
    this.addTrack(audioBuffer)
    return audioBuffer
  }

  // Multi-track playback
  playAt(startTime: number, offsetSec: number = 0): void {
    if (this.tracks.length === 0) return
    // Stop any previous playback first
    this.stopAll()
    const clampedOffset = Math.max(0, Math.min(offsetSec, this.getMaxDuration()))
    for (const buffer of this.tracks) {
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      // Route through the player's gain so existing volume control works
      src.connect(this.player.output)
      if (startTime <= this.ctx.currentTime) {
        src.start(0, Math.min(clampedOffset, buffer.duration))
      } else {
        src.start(startTime, Math.min(clampedOffset, buffer.duration))
      }
      this.activeSources.push(src)
      src.onended = () => {
        // Remove from active list when finished
        const idx = this.activeSources.indexOf(src)
        if (idx >= 0) this.activeSources.splice(idx, 1)
      }
    }
    this.playbackStartCtxTime = startTime <= this.ctx.currentTime ? this.ctx.currentTime : startTime
    this.playbackStartOffsetSec = clampedOffset
  }

  playImmediate(offsetSec: number = 0): void {
    this.playAt(this.ctx.currentTime, offsetSec)
  }

  playBuffersAt(startTime: number, offsetSec: number, buffers: ReadonlyArray<AudioBuffer>, mode?: 'original' | 'recording' | 'combined'): void {
    if (buffers.length === 0) return
    this.stopAll()
    const maxDur = this.getDurationForBuffers(buffers)
    const clampedOffset = Math.max(0, Math.min(offsetSec, maxDur))
    for (const buffer of buffers) {
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      src.connect(this.player.output)
      const off = Math.min(clampedOffset, buffer.duration)
      if (startTime <= this.ctx.currentTime) {
        src.start(0, off)
      } else {
        src.start(startTime, off)
      }
      this.activeSources.push(src)
      src.onended = () => {
        const idx = this.activeSources.indexOf(src)
        if (idx >= 0) this.activeSources.splice(idx, 1)
      }
    }
    this.playbackStartCtxTime = startTime <= this.ctx.currentTime ? this.ctx.currentTime : startTime
    this.playbackStartOffsetSec = clampedOffset
    this.currentMode = mode ?? this.currentMode
  }

  playBuffersImmediate(offsetSec: number, buffers: ReadonlyArray<AudioBuffer>): void {
    this.playBuffersAt(this.ctx.currentTime, offsetSec, buffers)
  }

  stopAll(): void {
    for (const s of this.activeSources) {
      try { s.stop() } catch {}
      try { s.disconnect() } catch {}
    }
    this.activeSources = []
    this.playbackStartCtxTime = null
    this.currentMode = null
  }

  getMaxDuration(): number {
    let max = 0
    for (const b of this.tracks) max = Math.max(max, b.duration)
    return max
  }

  getDurationForBuffers(buffers: ReadonlyArray<AudioBuffer>): number {
    let max = 0
    for (const b of buffers) max = Math.max(max, b.duration)
    return max
  }

  getOriginalTrack(): AudioBuffer | null {
    return this.tracks.length > 0 ? this.tracks[0] : null
    }

  getLatestRecordingTrack(): AudioBuffer | null {
    return this.tracks.length > 1 ? this.tracks[this.tracks.length - 1] : null
  }

  isAnyPlaying(): boolean {
    return this.activeSources.length > 0
  }

  getCurrentMode(): 'original' | 'recording' | 'combined' | null {
    return this.currentMode
  }

  getBuffersForMode(mode: 'original' | 'recording' | 'combined'): AudioBuffer[] {
    const original = this.getOriginalTrack()
    const latest = this.getLatestRecordingTrack()
    if (mode === 'original') return original ? [original] : []
    if (mode === 'recording') return latest ? [latest] : []
    return [original, latest].filter(Boolean) as AudioBuffer[]
  }

  getDurationForMode(mode: 'original' | 'recording' | 'combined'): number {
    return this.getDurationForBuffers(this.getBuffersForMode(mode))
  }
}

export const engineService = new EngineService()


