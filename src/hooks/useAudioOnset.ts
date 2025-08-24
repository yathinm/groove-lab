import { useCallback, useRef, useState } from 'react'
import { createRealTimeBpmProcessor, getBiquadFilter } from 'realtime-bpm-analyzer'
import { createAudioContext } from '../audio/createAudioContext'

export type UseAudioOnsetOptions = {
  analyserFftSize?: number
  bufferSize?: number
  smoothingTimeConstant?: number
  debounceMs?: number
  targetBpm?: number
  sensitivity?: number
  bpmWindowSeconds?: number
  minBpm?: number
  maxBpm?: number
  minConfidence?: number
  silenceResetMs?: number
  fluxSensitivity?: number
  minRmsGate?: number
  disableAudioProcessing?: boolean
  useRealtimeBpmAnalyzer?: boolean
  debugLogging?: boolean
  fluxEveryN?: number
  useWorkletOnset?: boolean
  hpHz?: number
  lpHz?: number
  requireRecentSignal?: boolean
  hitGateMs?: number
}

export type TimingStats = {
  currentBpm: number
  accuracy: number
  hitCount: number
}

export function useAudioOnset(options?: UseAudioOnsetOptions) {
  const {
    analyserFftSize = 1024,
    bufferSize = 256,
    smoothingTimeConstant = 0.2,
    debounceMs = 180,
    targetBpm = 120,
    sensitivity = 1.0,
    bpmWindowSeconds = 8,
    minBpm = 70,
    maxBpm = 180,
    minConfidence = 0.5,
    silenceResetMs = 2000,
    fluxSensitivity = 2.0,
    minRmsGate = 0.01,
    disableAudioProcessing = true,
    useRealtimeBpmAnalyzer = false,
    debugLogging = false,
    fluxEveryN = 2,
    useWorkletOnset = true,
    hpHz = 200,
    lpHz = 6000,
    requireRecentSignal = false,
    hitGateMs = 500,
  } = options || {}

  const [isRunning, setIsRunning] = useState(false)
  const [timingStats, setTimingStats] = useState<TimingStats>({
    currentBpm: 0,
    accuracy: 0,
    hitCount: 0,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const hpFilterRef = useRef<BiquadFilterNode | null>(null)
  const lpFilterRef = useRef<BiquadFilterNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const realtimeNodeRef = useRef<AudioWorkletNode | null>(null)
  const rbaBpmRef = useRef<number>(0)
  const smoothedBpmRef = useRef<number>(0)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const lastHitTimeRef = useRef<number>(0)
  const hitTimesRef = useRef<number[]>([])
  const hitCountRef = useRef<number>(0)

  // Energy-based detection refs
  const lastEnergyRef = useRef<number>(0)
  const emaEnergyRef = useRef<number>(0)
  const noiseFloorRef = useRef<number>(0.004)
  const lastEnvelopeRef = useRef<number>(0)
  const lastSlopeRef = useRef<number>(0)
  const lastHitEnvelopeRef = useRef<number>(0)
  const postHitDropSatisfiedRef = useRef<boolean>(true)

  // Ring buffer for BPM analysis (post-filter signal)
  const ringBufferRef = useRef<Float32Array | null>(null)
  const ringWriteIndexRef = useRef<number>(0)
  const ringCapacityRef = useRef<number>(0)
  const lastBpmAnalysisMsRef = useRef<number>(0)
  const lastBpmRef = useRef<number>(0)
  const bpmConfidenceRef = useRef<number>(0)
  const lastSignalMsRef = useRef<number>(0)
  const prevSpectrumRef = useRef<Float32Array | null>(null)
  const fluxEmaRef = useRef<number>(0)
  const fluxNoiseFloorRef = useRef<number>(1e-6)
  const freqDataRef = useRef<Float32Array | null>(null)
  const timeBufferRef = useRef<Float32Array | null>(null)
  const fluxCounterRef = useRef<number>(0)
  const onsetWorkletRef = useRef<AudioWorkletNode | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const silentSinkRef = useRef<GainNode | null>(null)
  const rbaSilentSinkRef = useRef<GainNode | null>(null)

  function writeToRingBuffer(samples: Float32Array) {
    const ring = ringBufferRef.current
    if (!ring) return
    let writeIndex = ringWriteIndexRef.current
    for (let i = 0; i < samples.length; i++) {
      ring[writeIndex] = samples[i]
      writeIndex++
      if (writeIndex >= ring.length) writeIndex = 0
    }
    ringWriteIndexRef.current = writeIndex
  }

  function readLatestFromRingBuffer(sampleCount: number): Float32Array | null {
    const ring = ringBufferRef.current
    if (!ring || sampleCount <= 0) return null
    const result = new Float32Array(sampleCount)
    const writeIndex = ringWriteIndexRef.current
    const start = (writeIndex - sampleCount + ring.length) % ring.length
    if (start + sampleCount <= ring.length) {
      result.set(ring.subarray(start, start + sampleCount), 0)
    } else {
      const firstLen = ring.length - start
      result.set(ring.subarray(start, ring.length), 0)
      result.set(ring.subarray(0, sampleCount - firstLen), firstLen)
    }
    return result
  }

  function acfBpmEstimate(envelope: Float32Array, sampleRate: number, minBpmLocal: number, maxBpmLocal: number): { bpm: number; confidence: number } | null {
    const minLag = Math.floor((60 / maxBpmLocal) * sampleRate)
    const maxLag = Math.floor((60 / minBpmLocal) * sampleRate)
    if (maxLag - minLag < 2) return null

    // Normalize envelope (zero mean, unit variance) for robust ACF
    let mean = 0
    for (let i = 0; i < envelope.length; i++) mean += envelope[i]
    mean /= envelope.length
    let variance = 0
    for (let i = 0; i < envelope.length; i++) {
      const d = envelope[i] - mean
      variance += d * d
    }
    const std = Math.sqrt(Math.max(variance / envelope.length, 1e-9))

    const n = envelope.length
    let bestLag = -1
    let bestR = -Infinity
    let secondBestR = -Infinity
    for (let lag = minLag; lag <= maxLag; lag++) {
      let r = 0
      for (let i = 0; i < n - lag; i++) {
        const a = (envelope[i] - mean) / std
        const b = (envelope[i + lag] - mean) / std
        r += a * b
      }
      r /= (n - lag)
      if (r > bestR) {
        secondBestR = bestR
        bestR = r
        bestLag = lag
      } else if (r > secondBestR) {
        secondBestR = r
      }
    }

    if (bestLag <= 0 || !isFinite(bestR)) return null
    const bpm = 60 / (bestLag / sampleRate)
    const confidence = Math.max(0, Math.min(1, (bestR - Math.max(0, secondBestR)) / (1 - Math.max(0, secondBestR) + 1e-6)))
    return { bpm, confidence }
  }

  function analyzeBpmFromRing() {
    const ctx = audioContextRef.current
    if (!ctx) return

    // Silence/inactivity gate: if quiet for a while, reset BPM to 0
    if (performance && performance.now) {
      const nowMs = performance.now()
      if (nowMs - lastSignalMsRef.current > silenceResetMs) {
        lastBpmRef.current = 0
        bpmConfidenceRef.current = 0
        setTimingStats((prev) => ({
          currentBpm: 0,
          accuracy: 0,
          hitCount: prev.hitCount,
        }))
        return
      }
    }

    const sampleRate = ctx.sampleRate
    const windowSamples = Math.min(ringCapacityRef.current, Math.floor(bpmWindowSeconds * sampleRate))
    const data = readLatestFromRingBuffer(windowSamples)
    if (!data) return
    // RMS gate for analysis window
    let wSumSq = 0
    for (let i = 0; i < data.length; i++) {
      const x = data[i]
      wSumSq += x * x
    }
    const wRms = Math.sqrt(wSumSq / data.length)
    if (wRms < minRmsGate) {
      lastBpmRef.current = 0
      bpmConfidenceRef.current = 0
      setTimingStats((prev) => ({
        currentBpm: 0,
        accuracy: 0,
        hitCount: prev.hitCount,
      }))
      return
    }

    // Use the envelope already lowpassed by EMA: build envelope array
    // Here ring buffer stores raw time-domain samples; compute short-time RMS per hop for BPM
    const frameSize = 256
    const hopSize = 128
    const frames = Math.max(0, Math.floor((data.length - frameSize) / hopSize))
    if (frames < 8) return
    const envelope = new Float32Array(frames)
    let write = 0
    for (let start = 0; start + frameSize <= data.length; start += hopSize) {
      let sum = 0
      for (let i = 0; i < frameSize; i++) {
        const x = data[start + i]
        sum += x * x
      }
      envelope[write++] = Math.sqrt(sum / frameSize)
    }

    // Light smoothing of envelope
    for (let i = 1; i < envelope.length; i++) {
      envelope[i] = 0.6 * envelope[i - 1] + 0.4 * envelope[i]
    }

    const hopRate = sampleRate / hopSize
    const result = acfBpmEstimate(envelope, hopRate, minBpm, maxBpm)
    if (!result) return
    if (result.confidence < minConfidence) {
      // Low confidence: treat as no reliable BPM
      lastBpmRef.current = 0
      bpmConfidenceRef.current = 0
      setTimingStats((prev) => ({
        currentBpm: 0,
        accuracy: 0,
        feedback: '-',
        hitCount: prev.hitCount,
      }))
      return
    }

    // Exponential smoothing of BPM and confidence
    const smoothing = 0.7
    if (lastBpmRef.current === 0) {
      lastBpmRef.current = result.bpm
      bpmConfidenceRef.current = result.confidence
    } else {
      lastBpmRef.current = smoothing * lastBpmRef.current + (1 - smoothing) * result.bpm
      bpmConfidenceRef.current = 0.8 * bpmConfidenceRef.current + 0.2 * result.confidence
    }

    const currentBpmVal = Math.round(lastBpmRef.current)
    const targetInterval = 60000 / targetBpm
    const currentInterval = 60000 / currentBpmVal
    const accuracy = Math.max(0, 100 - (Math.abs(currentInterval - targetInterval) / targetInterval) * 100)
    setTimingStats((prev) => ({
      currentBpm: currentBpmVal,
      accuracy: Math.round(accuracy),
      hitCount: prev.hitCount,
    }))
  }

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current
    const audioContext = audioContextRef.current
    if (!analyser || !audioContext) return

    // If using worklet onset, this callback is only for ring/flux sampling when ScriptProcessor is not used.
    // We still allow it to run if a ScriptProcessor is present (legacy path), but avoid onset detection work.

    // Reuse time-domain buffer to avoid per-callback allocations
    if (!timeBufferRef.current || timeBufferRef.current.length !== analyser.fftSize) {
      timeBufferRef.current = new Float32Array(analyser.fftSize)
    }
    const timeDomainData = timeBufferRef.current
    analyser.getFloatTimeDomainData(timeDomainData)

    // Write raw samples into ring buffer for BPM analysis (skip if using realtime analyzer)
    if (!useRealtimeBpmAnalyzer) {
      writeToRingBuffer(timeDomainData)
    }

    const now = audioContext.currentTime * 1000

    // If worklet handles onset detection, skip the energy-based detection on main thread
    let envelope = emaEnergyRef.current
    let dynamicThreshold = noiseFloorRef.current * sensitivity
    let slope = lastSlopeRef.current
    if (!useWorkletOnset) {
      // Energy-based detection with envelope peak logic
      let sumSquares = 0
      for (let i = 0; i < timeDomainData.length; i++) {
        const x = timeDomainData[i]
        sumSquares += x * x
      }
      const currentEnergy = Math.sqrt(sumSquares / timeDomainData.length)

      if (lastEnergyRef.current === 0) {
        emaEnergyRef.current = currentEnergy
        lastEnvelopeRef.current = currentEnergy
        noiseFloorRef.current = Math.max(noiseFloorRef.current, currentEnergy)
        lastEnergyRef.current = currentEnergy
        postHitDropSatisfiedRef.current = true
        return
      }

      const alpha = 0.92
      emaEnergyRef.current = alpha * emaEnergyRef.current + (1 - alpha) * currentEnergy
      envelope = emaEnergyRef.current
      slope = envelope - lastEnvelopeRef.current

      // Threshold purely from noise floor and sensitivity
      dynamicThreshold = noiseFloorRef.current * sensitivity

      const refractory = now - lastHitTimeRef.current < debounceMs

      // Require envelope to drop sufficiently after a hit before next hit
      if (!postHitDropSatisfiedRef.current) {
        const rearmLevel = Math.max(noiseFloorRef.current * 1.2, lastHitEnvelopeRef.current * 0.4)
        if (envelope <= rearmLevel) {
          postHitDropSatisfiedRef.current = true
        }
      }

      // Peak when envelope slope flips while above threshold
      const peakDetected = lastSlopeRef.current > 0 && slope <= 0 && envelope > dynamicThreshold

      if (!refractory && postHitDropSatisfiedRef.current && peakDetected) {
        const prev = hitTimesRef.current.length > 0 ? hitTimesRef.current[hitTimesRef.current.length - 1] : null
        lastHitTimeRef.current = now
        lastHitEnvelopeRef.current = envelope
        postHitDropSatisfiedRef.current = false

        // Validate with recent spectral/energy signal and plausible tempo range
        const nowWall = performance && performance.now ? performance.now() : now
        const recentSignal = nowWall - lastSignalMsRef.current <= hitGateMs
        const minIntervalMs = 60000 / Math.max(1, maxBpm)
        const maxIntervalMs = 60000 / Math.max(1, Math.max(1, minBpm))
        let accepted = true
        let intervalMs = 0
        if (prev !== null) {
          intervalMs = now - prev
          if (intervalMs < minIntervalMs || intervalMs > maxIntervalMs) accepted = false
        }
        if (requireRecentSignal && !recentSignal) accepted = false

        hitTimesRef.current.push(now)
        hitCountRef.current += 1
        if (hitTimesRef.current.length > 10) hitTimesRef.current = hitTimesRef.current.slice(-10)
        console.log(`HIT #${hitCountRef.current}${accepted ? '' : ' (ignored)'}`)

        if (!accepted || prev === null) return

        const times = hitTimesRef.current
        const instantBpm = 60000 / intervalMs
        const intervals: number[] = []
        for (let i = Math.max(1, times.length - 4); i < times.length; i++) {
          const d = times[i] - times[i - 1]
          if (d >= minIntervalMs && d <= maxIntervalMs) intervals.push(d)
        }
        const avgInterval = intervals.length > 0 ? intervals.reduce((s, v) => s + v, 0) / intervals.length : intervalMs
        const avgBpm = 60000 / avgInterval
        console.log('HIT', { t: now.toFixed(1) + 'ms', intervalMs: Math.round(intervalMs), instantBpm: Math.round(instantBpm), avgBpm: Math.round(avgBpm) })

        if (!useRealtimeBpmAnalyzer || rbaBpmRef.current === 0) {
          const targetInterval = 60000 / targetBpm
          const currentInterval = avgInterval
          const accuracy = Math.max(0, 100 - (Math.abs(currentInterval - targetInterval) / targetInterval) * 100)
          setTimingStats((prevStats) => ({
            currentBpm: Math.round(avgBpm),
            accuracy: Math.round(accuracy),
            hitCount: prevStats.hitCount + 0,
          }))
        }
      }
    }

    // Spectral flux gate to suppress stationary background noise (throttled)
    let fluxThreshold = fluxNoiseFloorRef.current * fluxSensitivity
    fluxCounterRef.current = (fluxCounterRef.current + 1) % Math.max(1, Math.floor(fluxEveryN))
    if (fluxCounterRef.current === 0) {
      if (!freqDataRef.current || freqDataRef.current.length !== analyser.frequencyBinCount) {
        freqDataRef.current = new Float32Array(analyser.frequencyBinCount)
      }
      const freqData = freqDataRef.current
      analyser.getFloatFrequencyData(freqData)
      let flux = 0
      if (!prevSpectrumRef.current || prevSpectrumRef.current.length !== freqData.length) {
        prevSpectrumRef.current = new Float32Array(freqData.length)
        for (let i = 0; i < freqData.length; i++) {
          prevSpectrumRef.current[i] = Math.pow(10, freqData[i] / 20)
        }
      } else {
        for (let i = 0; i < freqData.length; i++) {
          const mag = Math.pow(10, freqData[i] / 20)
          const prevMag = prevSpectrumRef.current[i]
          const diff = mag - prevMag
          if (diff > 0) flux += diff
          prevSpectrumRef.current[i] = mag
        }
      }
      const fluxAlpha = 0.9
      fluxEmaRef.current = fluxAlpha * fluxEmaRef.current + (1 - fluxAlpha) * flux
      if (fluxEmaRef.current > fluxNoiseFloorRef.current) {
        fluxNoiseFloorRef.current = 0.9 * fluxNoiseFloorRef.current + 0.1 * fluxEmaRef.current
      } else {
        fluxNoiseFloorRef.current = 0.995 * fluxNoiseFloorRef.current + 0.005 * fluxEmaRef.current
      }
      fluxThreshold = fluxNoiseFloorRef.current * fluxSensitivity
    }
    if (performance && performance.now) {
      const pnow = performance.now()
      if (envelope > dynamicThreshold || fluxEmaRef.current > fluxThreshold) {
        lastSignalMsRef.current = pnow
      }
    }

    // Noise floor is adapted by worklet path or above when not using worklet

    // Periodically run BPM analysis (~1s) when not using realtime analyzer
    if (!useRealtimeBpmAnalyzer && performance && performance.now) {
      const t = performance.now()
      if (t - lastBpmAnalysisMsRef.current > 1000) {
        lastBpmAnalysisMsRef.current = t
        analyzeBpmFromRing()
      }
    }

    // Update trackers when we computed envelope locally
    if (!useWorkletOnset) {
      lastSlopeRef.current = slope
      lastEnvelopeRef.current = envelope
    }
  }, [debounceMs, sensitivity, targetBpm, useWorkletOnset, useRealtimeBpmAnalyzer, fluxEveryN, fluxSensitivity])

  const start = useCallback(async () => {
    if (isRunning) return

    const audioContext = createAudioContext()
    audioContextRef.current = audioContext
    await audioContext.resume()

    // Reset detection state
    lastHitTimeRef.current = 0
    lastEnergyRef.current = 0
    emaEnergyRef.current = 0
    lastEnvelopeRef.current = 0
    lastSlopeRef.current = 0
    lastHitEnvelopeRef.current = 0
    noiseFloorRef.current = 0.004
    hitTimesRef.current = []
    hitCountRef.current = 0
    postHitDropSatisfiedRef.current = true
    lastBpmAnalysisMsRef.current = 0
    lastSignalMsRef.current = performance && performance.now ? performance.now() : 0

    mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: disableAudioProcessing ? false : true,
        noiseSuppression: disableAudioProcessing ? false : true,
        autoGainControl: disableAudioProcessing ? false : true,
        channelCount: 1,
      },
    } as MediaStreamConstraints)
    microphoneRef.current = audioContext.createMediaStreamSource(mediaStreamRef.current)

    // Band-pass (configurable for claps): default HP 300 Hz, LP 4000 Hz
    const hp = audioContext.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = hpHz
    hp.Q.value = 0.707
    hpFilterRef.current = hp

    const lp = audioContext.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    lp.Q.value = 0.707
    lpFilterRef.current = lp

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = analyserFftSize
    analyser.smoothingTimeConstant = smoothingTimeConstant
    analyserRef.current = analyser

    // Allocate ring buffer for BPM window
    ringCapacityRef.current = Math.floor(bpmWindowSeconds * audioContext.sampleRate)
    ringBufferRef.current = new Float32Array(ringCapacityRef.current)
    ringWriteIndexRef.current = 0

    // Create ScriptProcessor only if not using worklet onset
    if (!useWorkletOnset) {
      const allowed = [256, 512, 1024, 2048, 4096, 8192, 16384]
      const safeBufferSize = allowed.includes(bufferSize) ? bufferSize : 256
      const scriptNode = audioContext.createScriptProcessor(safeBufferSize, 1, 1)
      scriptNode.onaudioprocess = processAudio
      scriptNodeRef.current = scriptNode
    }

    // Optional realtime-bpm-analyzer
    if (useRealtimeBpmAnalyzer) {
      try {
        // Ensure worklet is loaded
        if (!('audioWorklet' in audioContext)) {
          console.warn('AudioWorklet not supported; skipping realtime-bpm-analyzer')
        } else {
          const rbaNode = await createRealTimeBpmProcessor(audioContext)
          realtimeNodeRef.current = rbaNode
          // Minimal pre-filter to focus on beat band
          const rbaFilter = getBiquadFilter(audioContext)
          const rbaSink = audioContext.createGain()
          rbaSink.gain.value = 0
          microphoneRef.current.connect(rbaFilter).connect(rbaNode)
          rbaNode.connect(rbaSink).connect(audioContext.destination)
          rbaSilentSinkRef.current = rbaSink
          rbaNode.port.onmessage = (event: MessageEvent) => {
            const msg = event.data
            if (!msg || !msg.message) return
            if (msg.message === 'BPM' || msg.message === 'BPM_STABLE') {
              const bpmValRaw = msg.data.bpm
              // Smooth BPM for display
              if (smoothedBpmRef.current === 0) smoothedBpmRef.current = bpmValRaw
              smoothedBpmRef.current = 0.7 * smoothedBpmRef.current + 0.3 * bpmValRaw
              const bpmVal = Math.round(smoothedBpmRef.current)
              rbaBpmRef.current = bpmVal
              const targetInterval = 60000 / targetBpm
              const currentInterval = 60000 / bpmVal
              const accuracy = Math.max(0, 100 - (Math.abs(currentInterval - targetInterval) / targetInterval) * 100)
              setTimingStats((prev) => ({
                currentBpm: bpmVal,
                accuracy: Math.round(accuracy),
                hitCount: prev.hitCount,
              }))
            }
          }
        }
      } catch (e) {
        console.warn('Failed to init realtime-bpm-analyzer, continuing without it', e)
      }
    }

    // Connect main analysis graph
    // mic -> HP -> LP
    microphoneRef.current.connect(hp)
    hp.connect(lp)

    // LP -> analyser (for ring/flux sampling)
    lp.connect(analyser)

    // LP -> onset worklet if enabled
    if (useWorkletOnset && 'audioWorklet' in audioContext) {
      try {
        await audioContext.audioWorklet.addModule(new URL('../audio/onset.worklet.js', import.meta.url))
        const onsetNode = new AudioWorkletNode(audioContext, 'onset-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          processorOptions: {
            sensitivity,
            debounceMs,
          },
        })
        onsetWorkletRef.current = onsetNode
        lp.connect(onsetNode)
        onsetNode.port.onmessage = (evt: MessageEvent) => {
          const data = evt.data as { type: string; timeMs: number }
          if (!data) return
          if (data.type === 'signal') {
            lastSignalMsRef.current = data.timeMs
          } else if (data.type === 'hit') {
            const now = data.timeMs
            const prev = hitTimesRef.current.length > 0 ? hitTimesRef.current[hitTimesRef.current.length - 1] : null
            lastHitTimeRef.current = now
            // Accept hit only if recent spectral/energy signal was observed
            const nowWall = performance && performance.now ? performance.now() : now
            const recentSignal = nowWall - lastSignalMsRef.current <= hitGateMs
            const minIntervalMs = 60000 / Math.max(1, maxBpm)
            const maxIntervalMs = 60000 / Math.max(1, Math.max(1, minBpm))
            // If prev exists, compute interval and validate
            let accepted = true
            let intervalMs = 0
            if (prev !== null) {
              intervalMs = now - prev
              if (intervalMs < minIntervalMs || intervalMs > maxIntervalMs) {
                accepted = false
              }
            }

            if (requireRecentSignal && !recentSignal) accepted = false

            // Always count/log the hit for debugging
            hitTimesRef.current.push(now)
            hitCountRef.current += 1
            if (hitTimesRef.current.length > 10) hitTimesRef.current = hitTimesRef.current.slice(-10)
            console.log(`HIT #${hitCountRef.current}${accepted ? '' : ' (ignored)'}`)

            if (!accepted || prev === null) return

            const times = hitTimesRef.current
            const instantBpm = 60000 / intervalMs
            const intervals: number[] = []
            for (let i = Math.max(1, times.length - 4); i < times.length; i++) {
              const d = times[i] - times[i - 1]
              if (d >= minIntervalMs && d <= maxIntervalMs) intervals.push(d)
            }
            const avgInterval = intervals.length > 0 ? intervals.reduce((s, v) => s + v, 0) / intervals.length : intervalMs
            const avgBpm = 60000 / avgInterval
            console.log('HIT', {
              t: now.toFixed(1) + 'ms',
              intervalMs: Math.round(intervalMs),
              instantBpm: Math.round(instantBpm),
              avgBpm: Math.round(avgBpm),
            })

            // Update displayed BPM from hits if realtime analyzer is off or has no BPM yet
            if (!useRealtimeBpmAnalyzer || rbaBpmRef.current === 0) {
              const targetInterval = 60000 / targetBpm
              const currentInterval = avgInterval
              const accuracy = Math.max(0, 100 - (Math.abs(currentInterval - targetInterval) / targetInterval) * 100)
              setTimingStats((prevStats) => ({
                currentBpm: Math.round(avgBpm),
                accuracy: Math.round(accuracy),
                hitCount: prevStats.hitCount + 0,
              }))
            }
          }
        }
      } catch (e) {
        console.warn('Failed to init onset worklet; falling back to ScriptProcessor', e)
        if (!scriptNodeRef.current) {
          const allowed = [256, 512, 1024, 2048, 4096, 8192, 16384]
          const safeBufferSize = allowed.includes(bufferSize) ? bufferSize : 256
          const scriptNode = audioContext.createScriptProcessor(safeBufferSize, 1, 1)
          scriptNode.onaudioprocess = processAudio
          scriptNodeRef.current = scriptNode
        }
      }
    }

    // Ensure the graph is pulled by connecting a silent sink to destination
    if (!silentSinkRef.current) {
      const sink = audioContext.createGain()
      sink.gain.value = 0
      lp.connect(sink)
      sink.connect(audioContext.destination)
      silentSinkRef.current = sink
    }

    // If ScriptProcessor is present, connect it to drive processAudio; otherwise, start a rAF sampler
    if (scriptNodeRef.current) {
      analyser.connect(scriptNodeRef.current)
      scriptNodeRef.current.connect(audioContext.destination)
    } else {
      const tick = () => {
        processAudio()
        rafIdRef.current = self.requestAnimationFrame(tick)
      }
      rafIdRef.current = self.requestAnimationFrame(tick)
    }

    setIsRunning(true)
    if (debugLogging) console.log('mic started')
  }, [analyserFftSize, bpmWindowSeconds, bufferSize, isRunning, processAudio, smoothingTimeConstant, useWorkletOnset, sensitivity, debounceMs, targetBpm, useRealtimeBpmAnalyzer, debugLogging])

  const stop = useCallback(() => {
    if (!isRunning) return

    microphoneRef.current?.disconnect()
    hpFilterRef.current?.disconnect()
    lpFilterRef.current?.disconnect()
    analyserRef.current?.disconnect()
    scriptNodeRef.current?.disconnect()
    onsetWorkletRef.current?.disconnect?.()
    realtimeNodeRef.current?.disconnect()
    if (scriptNodeRef.current) {
      scriptNodeRef.current.onaudioprocess = null
    }
    if (rafIdRef.current !== null) {
      self.cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioContextRef.current?.close()

    microphoneRef.current = null
    hpFilterRef.current = null
    lpFilterRef.current = null
    analyserRef.current = null
    scriptNodeRef.current = null
    onsetWorkletRef.current = null
    mediaStreamRef.current = null
    audioContextRef.current = null

    setIsRunning(false)
    if (debugLogging) console.log('mic stopped')

    // Reset timing stats
    setTimingStats({
      currentBpm: 0,
      accuracy: 0,
      hitCount: 0,
    })
    hitTimesRef.current = []
    hitCountRef.current = 0
    lastSignalMsRef.current = 0
    timeBufferRef.current = null
  }, [isRunning])

  return { isRunning, start, stop, timingStats }
}


