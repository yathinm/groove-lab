import { useCallback, useRef, useState } from 'react'
import { createAudioContext } from '../audio/createAudioContext'
import { detectOnset } from '../audio/detectOnset'

export type UseAudioOnsetOptions = {
  analyserFftSize?: number
  bufferSize?: number
  smoothingTimeConstant?: number
  debounceMs?: number
  threshold?: number
}

export function useAudioOnset(options?: UseAudioOnsetOptions) {
  const {
    analyserFftSize = 1024,
    bufferSize = 256,
    smoothingTimeConstant = 0.2,
    debounceMs = 50,
    threshold = 0.1,
  } = options || {}

  const [isRunning, setIsRunning] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const lastHitTimeRef = useRef<number>(0)

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current
    const audioContext = audioContextRef.current
    if (!analyser || !audioContext) return

    const timeDomainData = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(timeDomainData)

    const now = audioContext.currentTime * 1000
    if (now - lastHitTimeRef.current < debounceMs) {
      return
    }

    const { detected, peak, dynamicThreshold } = detectOnset(timeDomainData, threshold)
    if (detected) {
      lastHitTimeRef.current = now
      console.log('HIT DETECTED! Peak amplitude:', peak.toFixed(3), 'Threshold:', dynamicThreshold.toFixed(3))
    }
    if (process.env.NODE_ENV !== 'production') {
      const peakStr = peak.toFixed(3)
      const thrStr = dynamicThreshold.toFixed(3)
      if (!detected) {
        if (Math.random() < 0.01) console.log(`[debug] peak=${peakStr} dynThr=${thrStr}`)
      }
    }
  }, [debounceMs, threshold])

  const start = useCallback(async () => {
    if (isRunning) return

    const audioContext = createAudioContext()
    audioContextRef.current = audioContext
    await audioContext.resume()

    mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    microphoneRef.current = audioContext.createMediaStreamSource(mediaStreamRef.current)

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = analyserFftSize
    analyser.smoothingTimeConstant = smoothingTimeConstant
    analyserRef.current = analyser

    const allowed = [256, 512, 1024, 2048, 4096, 8192, 16384]
    const safeBufferSize = allowed.includes(bufferSize) ? bufferSize : 256
    const scriptNode = audioContext.createScriptProcessor(safeBufferSize, 1, 1)
    scriptNode.onaudioprocess = processAudio
    scriptNodeRef.current = scriptNode

    microphoneRef.current.connect(analyser)
    analyser.connect(scriptNode)
    scriptNode.connect(audioContext.destination)

    setIsRunning(true)
    console.log('mic started')
  }, [analyserFftSize, bufferSize, isRunning, processAudio, smoothingTimeConstant])

  const stop = useCallback(() => {
    if (!isRunning) return

    microphoneRef.current?.disconnect()
    analyserRef.current?.disconnect()
    scriptNodeRef.current?.disconnect()
    if (scriptNodeRef.current) {
      scriptNodeRef.current.onaudioprocess = null
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioContextRef.current?.close()

    microphoneRef.current = null
    analyserRef.current = null
    scriptNodeRef.current = null
    mediaStreamRef.current = null
    audioContextRef.current = null

    setIsRunning(false)
    console.log('mic stopped')
  }, [isRunning])

  return { isRunning, start, stop }
}


