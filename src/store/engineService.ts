import { createAudioContext } from '../audio/createAudioContext'
import { AudioPlayer } from '../audio/player'
import { Metronome } from '../audio/metronome'
import { MicrophoneRecorder } from '../audio/recorder'

class EngineService {
  private ctx: AudioContext
  readonly player: AudioPlayer
  readonly metronome: Metronome
  readonly recorder: MicrophoneRecorder

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
}

export const engineService = new EngineService()


