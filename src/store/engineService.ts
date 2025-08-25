import { createAudioContext } from '../audio/createAudioContext'
import { AudioPlayer } from '../audio/player'
import { Metronome } from '../audio/metronome'

class EngineService {
  private ctx: AudioContext
  readonly player: AudioPlayer
  readonly metronome: Metronome

  constructor() {
    this.ctx = createAudioContext()
    this.player = new AudioPlayer(this.ctx)
    this.metronome = new Metronome(this.ctx)
  }

  get audioContext(): AudioContext {
    return this.ctx
  }

  getPositionSec(): number {
    return this.player.getPlaybackOffsetSeconds(this.ctx.currentTime)
  }
}

export const engineService = new EngineService()


