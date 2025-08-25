import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createAudioContext } from '../audio/createAudioContext'
import { AudioPlayer } from '../audio/player'
import { Metronome } from '../audio/metronome'
import { detectBpmFromAudioBuffer } from '../audio/bpm'

export type AudioEngineState = {
  isPlaying: boolean
  processing: boolean
  error: string | null
  bpm: number | null
  positionSec: number
  durationSec: number
  trackVolume: number
  metroVolume: number
}

export type AudioEngineActions = {
  onSelectFile: (file: File | null) => Promise<void>
  playPause: () => Promise<void>
  seekTo: (seconds: number) => Promise<void>
  skip: (deltaSeconds: number) => Promise<void>
  setTrackVolume: (v: number) => void
  setMetroVolume: (v: number) => void
  getPositionSec: () => number
}

export function useAudioEngine(): { state: AudioEngineState; actions: AudioEngineActions } {
  const audioContextRef = useRef<AudioContext | null>(null)
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext()
    }
    return audioContextRef.current
  }, [])

  const player = useMemo(() => new AudioPlayer(ensureAudioContext()), [ensureAudioContext])
  const metronome = useMemo(() => new Metronome(ensureAudioContext()), [ensureAudioContext])

  const [isPlaying, setIsPlaying] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bpm, setBpm] = useState<number | null>(null)
  const [positionSec, setPositionSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [trackVolume, setTrackVolume] = useState(0.9)
  const [metroVolume, setMetroVolume] = useState(0.7)

  useEffect(() => {
    player.setVolume(trackVolume)
  }, [player, trackVolume])

  useEffect(() => {
    metronome.setVolume(metroVolume)
  }, [metronome, metroVolume])

  const getPositionSec = useCallback((): number => {
    const ctx = ensureAudioContext()
    return player.getPlaybackOffsetSeconds(ctx.currentTime)
  }, [ensureAudioContext, player])

  const onSelectFile = useCallback(async (file: File | null) => {
    const ctx = ensureAudioContext()
    // stop current
    if (isPlaying) {
      metronome.stop()
      player.stop()
      setIsPlaying(false)
    }
    setBpm(null)
    setError(null)
    setDurationSec(0)
    if (!file) return
    try {
      setProcessing(true)
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      player.setBuffer(decoded)
      player.setMediaFile(file)
      setDurationSec(decoded.duration)
      const detected = await detectBpmFromAudioBuffer(decoded)
      setBpm(Math.round(detected))
      metronome.setBpm(detected)
    } catch (e) {
      setError((e as Error).message || 'Failed to process file')
    } finally {
      setProcessing(false)
    }
  }, [ensureAudioContext, isPlaying, metronome, player])

  const playPause = useCallback(async () => {
    const ctx = ensureAudioContext()
    if (!isPlaying) {
      if (ctx.state === 'suspended') await ctx.resume()
      if ((player as unknown as any).hasMedia?.()) {
        ;(player as unknown as any).playMediaAt(positionSec)
        const startAt = ctx.currentTime + 0.02
        if (bpm) metronome.setBpm(bpm)
        metronome.startAt(startAt)
      } else {
        const startAt = ctx.currentTime + 0.03
        player.playAt(startAt, positionSec)
        if (bpm) metronome.setBpm(bpm)
        metronome.startAt(startAt)
      }
      setIsPlaying(true)
    } else {
      metronome.stop()
      player.stop()
      setIsPlaying(false)
    }
  }, [bpm, ensureAudioContext, isPlaying, metronome, player, positionSec])

  const seekTo = useCallback(async (seconds: number) => {
    const ctx = ensureAudioContext()
    const dur = player.getDurationSeconds()
    const clamped = Math.max(0, Math.min(seconds, dur))
    setPositionSec(clamped)
    metronome.stop()
    player.stop()
    if (ctx.state === 'suspended') await ctx.resume()
    if ((player as unknown as any).hasMedia?.()) {
      ;(player as unknown as any).playMediaAt(clamped)
    } else {
      player.playImmediate(clamped)
    }
    if (bpm) metronome.setBpm(bpm)
    const startAt = ctx.currentTime + 0.02
    metronome.startAt(startAt)
    setIsPlaying(true)
  }, [bpm, ensureAudioContext, metronome, player])

  const skip = useCallback(async (deltaSeconds: number) => {
    const ctx = ensureAudioContext()
    const base = player.getPlaybackOffsetSeconds(ctx.currentTime)
    await seekTo(base + deltaSeconds)
  }, [ensureAudioContext, player, seekTo])

  return {
    state: {
      isPlaying,
      processing,
      error,
      bpm,
      positionSec,
      durationSec,
      trackVolume,
      metroVolume,
    },
    actions: {
      onSelectFile,
      playPause,
      seekTo,
      skip,
      setTrackVolume,
      setMetroVolume,
      getPositionSec,
    },
  }
}


