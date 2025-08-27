import type lamejsNS from 'lamejs'

export type RecorderStopResult = {
  wavBlob: Blob
  wavUrl: string
  mp3Blob?: Blob
  mp3Url?: string
}

export class MicrophoneRecorder {
  private readonly audioContext: AudioContext
  private mediaStream: MediaStream | null = null
  private mediaSource: MediaStreamAudioSourceNode | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isCollecting: boolean = false
  private recordedChunks: Float32Array[] = []
  private monitorGain: GainNode | null = null

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  get armed(): boolean {
    return !!this.mediaStream
  }

  get recording(): boolean {
    return this.isCollecting
  }

  async arm(): Promise<void> {
    if (this.mediaStream) return
    const desiredRate = this.audioContext.sampleRate
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: desiredRate,
      } as MediaTrackConstraints,
    })
    this.mediaStream = stream
    // eslint-disable-next-line no-console
    console.log('[RECORDER] armed: mediaStream tracks', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: (t as any).readyState })))
    this.setupNodes()
  }

  disarm(): void {
    this.stop()
    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect() } catch {}
      this.scriptProcessor.onaudioprocess = null
      this.scriptProcessor = null
    }
    if (this.mediaSource) {
      try { this.mediaSource.disconnect() } catch {}
      this.mediaSource = null
    }
    if (this.monitorGain) {
      try { this.monitorGain.disconnect() } catch {}
      this.monitorGain = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => {
        try { t.stop() } catch {}
      })
      this.mediaStream = null
    }
    this.recordedChunks = []
  }

  private setupNodes(): void {
    if (!this.mediaStream) return
    // Input source from microphone
    this.mediaSource = this.audioContext.createMediaStreamSource(this.mediaStream)

    // Optional monitor path (muted by default)
    this.monitorGain = this.audioContext.createGain()
    this.monitorGain.gain.value = 0 // set to >0 to hear yourself

    // ScriptProcessor to capture raw PCM frames
    const bufferSize = 4096
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)
    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.isCollecting) return
      const inputData = event.inputBuffer.getChannelData(0)
      this.recordedChunks.push(new Float32Array(inputData))
      // eslint-disable-next-line no-console
      if (this.recordedChunks.length % 50 === 0) console.log('[RECORDER] collecting chunks', { count: this.recordedChunks.length, chunkLen: inputData.length })
    }

    // Wiring: mic → [split] → scriptProcessor and optional monitor → destination
    this.mediaSource.connect(this.scriptProcessor)
    this.mediaSource.connect(this.monitorGain)
    this.monitorGain.connect(this.audioContext.destination)
    this.scriptProcessor.connect(this.audioContext.destination) // keep node active
  }

  start(): void {
    if (!this.mediaStream || !this.scriptProcessor) return
    this.recordedChunks = []
    this.isCollecting = true
    // eslint-disable-next-line no-console
    console.log('[RECORDER] start collecting')
  }

  stop(): RecorderStopResult | null {
    if (!this.isCollecting) return null
    this.isCollecting = false
    // eslint-disable-next-line no-console
    console.log('[RECORDER] stop collecting: chunks', this.recordedChunks.length)
    const wavBlob = this.encodeWavFromChunks()
    const wavUrl = URL.createObjectURL(wavBlob)
    let mp3Blob: Blob | undefined
    let mp3Url: string | undefined
    try {
      mp3Blob = this.encodeMp3FromChunks()
      mp3Url = URL.createObjectURL(mp3Blob)
    } catch {
      // ignore MP3 failure - WAV will still be available
    }
    // eslint-disable-next-line no-console
    console.log('[RECORDER] stop result', { wavSize: wavBlob.size, hasMp3: !!mp3Blob })
    return { wavBlob, wavUrl, mp3Blob, mp3Url }
  }

  private encodeWavFromChunks(): Blob {
    const sampleRate = this.audioContext.sampleRate
    const merged = this.mergeFloat32(this.recordedChunks)
    const pcm16 = this.floatTo16BitPCM(merged)
    const wavBuffer = this.buildWavFile(pcm16, sampleRate, 1)
    return new Blob([wavBuffer], { type: 'audio/wav' })
  }

  private encodeMp3FromChunks(): Blob {
    const lamejs = (require('lamejs') as typeof lamejsNS)
    const sampleRate = this.audioContext.sampleRate
    const merged = this.mergeFloat32(this.recordedChunks)
    const normalized = this.normalizeFloat32(merged, 0.95)
    const pcm16 = this.floatTo16BitPCM(normalized)

    const channels = 1
    const kbps = 192
    const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps)

    const samplesPerFrame = 1152
    let mp3Data: Uint8Array[] = []
    for (let i = 0; i < pcm16.length; i += samplesPerFrame) {
      const left = pcm16.subarray(i, i + samplesPerFrame)
      const mp3buf = encoder.encodeBuffer(left)
      if (mp3buf.length > 0) mp3Data.push(mp3buf)
    }
    const endBuf = encoder.flush()
    if (endBuf.length > 0) mp3Data.push(endBuf)
    return new Blob(mp3Data, { type: 'audio/mpeg' })
  }

  private mergeFloat32(chunks: Float32Array[]): Float32Array {
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }

  private normalizeFloat32(float32: Float32Array, targetPeak: number = 0.98): Float32Array {
    let peak = 0
    for (let i = 0; i < float32.length; i++) {
      const v = Math.abs(float32[i])
      if (v > peak) peak = v
    }
    if (peak === 0) return float32
    const gain = targetPeak / peak
    const out = new Float32Array(float32.length)
    for (let i = 0; i < float32.length; i++) out[i] = float32[i] * gain
    return out
  }

  private floatTo16BitPCM(float32: Float32Array): Int16Array {
    const output = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return output
  }

  private buildWavFile(pcm16: Int16Array, sampleRate: number, numChannels: number): ArrayBuffer {
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = pcm16.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    this.writeString(view, 8, 'WAVE')

    // fmt chunk
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bytesPerSample * 8, true)

    // data chunk
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // PCM samples
    let offset = 44
    for (let i = 0; i < pcm16.length; i++, offset += 2) {
      view.setInt16(offset, pcm16[i], true)
    }
    return buffer
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }
}


