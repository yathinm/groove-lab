import { useCallback, useRef, useState } from 'react'
import { createAudioContext } from '../audio/createAudioContext'

export type UseAudioOnsetOptions = {
  analyserFftSize?: number
  bufferSize?: number
  smoothingTimeConstant?: number
  debounceMs?: number
  targetBpm?: number
  sensitivity?: number
  bpmWindowSeconds?: number
}

export type TimingStats = {
  currentBpm: number
  accuracy: number
  feedback: string
  hitCount: number
}

export function useAudioOnset(options?: UseAudioOnsetOptions) {
  const {
    analyserFftSize = 1024,
    bufferSize = 256,
    smoothingTimeConstant = 0.2,
    debounceMs = 250,
    targetBpm = 120,
    sensitivity = 2.5,
    bpmWindowSeconds = 8,
  } = options || {}

  const [isRunning, setIsRunning] = useState(false)
  const [timingStats, setTimingStats] = useState<TimingStats>({
    currentBpm: 0,
    accuracy: 0,
    feedback: '-',
    hitCount: 0,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const hpFilterRef = useRef<BiquadFilterNode | null>(null)
  const lpFilterRef = useRef<BiquadFilterNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const lastHitTimeRef = useRef<number>(0)
  const hitTimesRef = useRef<number[]>([])

  // Energy-based detection refs
  const lastEnergyRef = useRef<number>(0)
  const emaEnergyRef = useRef<number>(0)
  const noiseFloorRef = useRef<number>(0.004)
  const triggerArmedRef = useRef<boolean>(true)
  const aboveCountRef = useRef<number>(0)

  // Ring buffer for BPM analysis (post-filter signal)
  const ringBufferRef = useRef<Float32Array | null>(null)
  const ringWriteIndexRef = useRef<number>(0)
  const ringCapacityRef = useRef<number>(0)
  const lastBpmAnalysisMsRef = useRef<number>(0)

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

  function getPeaksAtThreshold(data: Float32Array, threshold: number, sampleRate: number): number[] {
    const peaks: number[] = []
    const skipSamples = Math.floor(sampleRate / 4) // ~250ms
    for (let i = 0; i < data.length; ) {
      if (data[i] > threshold) {
        peaks.push(i)
        i += skipSamples
        continue
      }
      i++
    }
    return peaks
  }

  function countIntervalsBetweenNearbyPeaks(peaks: number[]): Array<{ interval: number; count: number }> {
    const intervalCounts: Array<{ interval: number; count: number }> = []
    for (let index = 0; index < peaks.length; index++) {
      const peak = peaks[index]
      for (let i = 1; i <= 10 && index + i < peaks.length; i++) {
        const interval = peaks[index + i] - peak
        let found = false
        for (let j = 0; j < intervalCounts.length; j++) {
          if (intervalCounts[j].interval === interval) {
            intervalCounts[j].count++
            found = true
            break
          }
        }
        if (!found) intervalCounts.push({ interval, count: 1 })
      }
    }
    return intervalCounts
  }

  function groupIntervalsToTempo(intervalCounts: Array<{ interval: number; count: number }>, sampleRate: number): Array<{ tempo: number; count: number }> {
    const tempoCounts: Array<{ tempo: number; count: number }> = []
    for (let i = 0; i < intervalCounts.length; i++) {
      const interval = intervalCounts[i].interval
      if (interval <= 0) continue
      let theoreticalTempo = 60 / (interval / sampleRate)
      while (theoreticalTempo < 90) theoreticalTempo *= 2
      while (theoreticalTempo > 180) theoreticalTempo /= 2
      let found = false
      for (let j = 0; j < tempoCounts.length; j++) {
        if (Math.abs(tempoCounts[j].tempo - theoreticalTempo) < 0.5) {
          tempoCounts[j].count += intervalCounts[i].count
          found = true
          break
        }
      }
      if (!found) tempoCounts.push({ tempo: theoreticalTempo, count: intervalCounts[i].count })
    }
    return tempoCounts
  }

  function analyzeBpmFromRing() {
    const ctx = audioContextRef.current
    const analyser = analyserRef.current
    if (!ctx || !analyser) return

    const sampleRate = ctx.sampleRate
    const windowSamples = Math.min(ringCapacityRef.current, Math.floor(bpmWindowSeconds * sampleRate))
    const data = readLatestFromRingBuffer(windowSamples)
    if (!data) return

    // Compute dynamic threshold using RMS of the window
    let sumSquares = 0
    for (let i = 0; i < data.length; i++) {
      const x = data[i]
      sumSquares += x * x
    }
    const rms = Math.sqrt(sumSquares / data.length)
    const threshold = rms * 2.2

    const peaks = getPeaksAtThreshold(data, threshold, sampleRate)
    if (peaks.length < 3) return

    const intervals = countIntervalsBetweenNearbyPeaks(peaks)
    const tempos = groupIntervalsToTempo(intervals, sampleRate)
    if (tempos.length === 0) return

    tempos.sort((a, b) => b.count - a.count)
    const best = tempos[0]

    // Update current BPM and accuracy/feedback vs target
    const currentBpmVal = Math.round(best.tempo)
    const targetInterval = 60000 / targetBpm
    const currentInterval = 60000 / currentBpmVal
    const accuracy = Math.max(0, 100 - (Math.abs(currentInterval - targetInterval) / targetInterval) * 100)
    let feedback = 'On Time'
    const toleranceMs = targetInterval * 0.1
    const diff = currentInterval - targetInterval
    if (diff < -toleranceMs) feedback = 'Rushing'
    else if (diff > toleranceMs) feedback = 'Dragging'

    setTimingStats((prev) => ({
      currentBpm: currentBpmVal,
      accuracy: Math.round(accuracy),
      feedback,
      hitCount: prev.hitCount,
    }))
  }

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current
    const audioContext = audioContextRef.current
    if (!analyser || !audioContext) return

    const timeDomainData = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(timeDomainData)

    // Write filtered samples into ring buffer for BPM analysis
    writeToRingBuffer(timeDomainData)

    const now = audioContext.currentTime * 1000
    const refractory = now - lastHitTimeRef.current < debounceMs

    // Energy-based quick onset detection with hysteresis & multi-frame confirmation
    let sumSquares = 0
    for (let i = 0; i < timeDomainData.length; i++) {
      const x = timeDomainData[i]
      sumSquares += x * x
    }
    const currentEnergy = Math.sqrt(sumSquares / timeDomainData.length)

    if (lastEnergyRef.current === 0) {
      emaEnergyRef.current = currentEnergy
      noiseFloorRef.current = Math.max(noiseFloorRef.current, currentEnergy)
      lastEnergyRef.current = currentEnergy
      return
    }

    const alpha = 0.92
    emaEnergyRef.current = alpha * emaEnergyRef.current + (1 - alpha) * currentEnergy
    const rawSpike = currentEnergy - emaEnergyRef.current
    const energySpike = Math.max(0, rawSpike)
    const baseThreshold = noiseFloorRef.current * sensitivity
    const emaClampHigh = emaEnergyRef.current * 0.5
    const highThreshold = Math.max(baseThreshold, emaClampHigh)
    const lowThreshold = highThreshold * 0.4

    // Update noise floor (fast up, very slow down)
    const upRate = 0.12
    const downRate = 0.003
    if (currentEnergy > noiseFloorRef.current) {
      noiseFloorRef.current = (1 - upRate) * noiseFloorRef.current + upRate * currentEnergy
    } else {
      noiseFloorRef.current = (1 - downRate) * noiseFloorRef.current + downRate * currentEnergy
    }

    // Hysteresis state machine
    if (triggerArmedRef.current && !refractory) {
      const minAbs = 0.006
      if (energySpike > highThreshold && currentEnergy > minAbs && currentEnergy > noiseFloorRef.current * 1.6) {
        aboveCountRef.current += 1
        if (aboveCountRef.current >= 2) {
          // Fire hit
          const prev = hitTimesRef.current.length > 0 ? hitTimesRef.current[hitTimesRef.current.length - 1] : null
          lastHitTimeRef.current = now
          hitTimesRef.current.push(now)
          if (hitTimesRef.current.length > 10) hitTimesRef.current = hitTimesRef.current.slice(-10)
          triggerArmedRef.current = false
          aboveCountRef.current = 0

          if (prev !== null) {
            const intervalMs = now - prev
            const instantBpm = 60000 / intervalMs
            const targetInterval = 60000 / targetBpm
            const errorMs = intervalMs - targetInterval
            const errorPct = (errorMs / targetInterval) * 100
            const verdict = Math.abs(errorMs) <= targetInterval * 0.05 ? 'On Time' : errorMs < 0 ? 'Rushing' : 'Dragging'
            const times = hitTimesRef.current
            const intervals: number[] = []
            for (let i = Math.max(1, times.length - 4); i < times.length; i++) {
              intervals.push(times[i] - times[i - 1])
            }
            const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length
            const avgBpm = 60000 / avgInterval
            console.log('HIT', {
              t: now.toFixed(1) + 'ms', intervalMs: Math.round(intervalMs), instantBpm: Math.round(instantBpm), avgBpm: Math.round(avgBpm), targetBpm, errorMs: Math.round(errorMs), errorPct: Math.round(errorPct), verdict,
            })
          } else {
            console.log('HIT (first)')
          }
        }
      } else {
        aboveCountRef.current = 0
      }
    } else {
      // Rearm only when clearly below low threshold
      if (energySpike < lowThreshold && currentEnergy < noiseFloorRef.current * 1.2) {
        triggerArmedRef.current = true
      }
    }

    // Periodically run BPM analysis (~1s)
    if (performance && performance.now) {
      const t = performance.now()
      if (t - lastBpmAnalysisMsRef.current > 1000) {
        lastBpmAnalysisMsRef.current = t
        analyzeBpmFromRing()
      }
    }

    lastEnergyRef.current = currentEnergy
  }, [debounceMs, sensitivity, targetBpm])

  const start = useCallback(async () => {
    if (isRunning) return

    const audioContext = createAudioContext()
    audioContextRef.current = audioContext
    await audioContext.resume()

    // Reset detection state
    lastHitTimeRef.current = 0
    lastEnergyRef.current = 0
    emaEnergyRef.current = 0
    noiseFloorRef.current = 0.004
    hitTimesRef.current = []
    triggerArmedRef.current = true
    aboveCountRef.current = 0
    lastBpmAnalysisMsRef.current = 0

    mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    } as MediaStreamConstraints)
    microphoneRef.current = audioContext.createMediaStreamSource(mediaStreamRef.current)

    // High-pass then Low-pass to form a band around drum transients
    const hp = audioContext.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 100
    hp.Q.value = 0.707
    hpFilterRef.current = hp

    const lp = audioContext.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 180
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

    const allowed = [256, 512, 1024, 2048, 4096, 8192, 16384]
    const safeBufferSize = allowed.includes(bufferSize) ? bufferSize : 256
    const scriptNode = audioContext.createScriptProcessor(safeBufferSize, 1, 1)
    scriptNode.onaudioprocess = processAudio
    scriptNodeRef.current = scriptNode

    // Connect graph: mic -> HP -> LP -> analyser -> script -> destination
    microphoneRef.current.connect(hp)
    hp.connect(lp)
    lp.connect(analyser)
    analyser.connect(scriptNode)
    scriptNode.connect(audioContext.destination)

    setIsRunning(true)
    console.log('mic started')
  }, [analyserFftSize, bpmWindowSeconds, bufferSize, isRunning, processAudio, smoothingTimeConstant])

  const stop = useCallback(() => {
    if (!isRunning) return

    microphoneRef.current?.disconnect()
    hpFilterRef.current?.disconnect()
    lpFilterRef.current?.disconnect()
    analyserRef.current?.disconnect()
    scriptNodeRef.current?.disconnect()
    if (scriptNodeRef.current) {
      scriptNodeRef.current.onaudioprocess = null
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioContextRef.current?.close()

    microphoneRef.current = null
    hpFilterRef.current = null
    lpFilterRef.current = null
    analyserRef.current = null
    scriptNodeRef.current = null
    mediaStreamRef.current = null
    audioContextRef.current = null

    setIsRunning(false)
    console.log('mic stopped')

    // Reset timing stats
    setTimingStats({
      currentBpm: 0,
      accuracy: 0,
      feedback: '-',
      hitCount: 0,
    })
    hitTimesRef.current = []
  }, [isRunning])

  return { isRunning, start, stop, timingStats }
}


