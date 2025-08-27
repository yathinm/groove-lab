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
}

export const engineService = new EngineService()


