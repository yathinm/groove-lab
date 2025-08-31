import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { store } from '../store'
import { engineService } from '../store/engineService'

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

async function blobFromObjectUrl(objectUrl: string): Promise<Blob> {
  const res = await fetch(objectUrl)
  if (!res.ok) throw new Error(`Failed to read blob from URL: ${res.status}`)
  return res.blob()
}

export async function uploadAudio(userId: string, audioBlob: Blob, fileName: string): Promise<string | null> {
  const safeName = sanitizeFileName(fileName)
  const filePath = `${userId}/${Date.now()}_${safeName}.wav`

  const { error: uploadError } = await supabase.storage
    .from('Project-Audio')
    .upload(filePath, audioBlob, { contentType: 'audio/wav', cacheControl: '3600', upsert: false })

  if (uploadError) {
    // eslint-disable-next-line no-console
    console.error('Error uploading audio:', uploadError.message)
    return null
  }

  const { data } = supabase.storage
    .from('Project-Audio')
    .getPublicUrl(filePath)

  return data.publicUrl
}

export type SaveChoices = {
  saveRecording: boolean
  saveCombined: boolean
}

async function renderCombinedMixdownWav(): Promise<Blob | null> {
  const original = engineService.getOriginalTrack()
  const recording = engineService.getLatestRecordingTrack()
  if (!original && !recording) return null

  const sampleRate = 44100
  const durationSec = Math.max(original?.duration ?? 0, recording?.duration ?? 0)
  const numChannels = Math.max(original?.numberOfChannels ?? 1, recording?.numberOfChannels ?? 1)
  const length = Math.max(1, Math.ceil(durationSec * sampleRate))
  const ctx = new OfflineAudioContext(numChannels, length, sampleRate)

  const connectBuffer = (buffer: AudioBuffer | null) => {
    if (!buffer) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 1.0
    src.connect(gain).connect(ctx.destination)
    src.start(0)
  }

  connectBuffer(original)
  connectBuffer(recording)

  const rendered = await ctx.startRendering()
  return audioBufferToWavBlob(rendered)
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const interleaved = interleave(buffer)

  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = interleaved.length * bytesPerSample
  const bufferSize = 44 + dataSize
  const arrayBuffer = new ArrayBuffer(bufferSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples
  let offset = 44
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function interleave(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels
  if (numChannels === 1) {
    return buffer.getChannelData(0).slice()
  }
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))
  const length = buffer.length
  const result = new Float32Array(length * numChannels)
  let write = 0
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) result[write++] = channels[c][i]
  }
  return result
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

export async function handleSaveProject(projectName: string, user: User, choices: SaveChoices): Promise<boolean> {
  const state = store.getState().audio

  // Gather latest recorded WAV from in-memory URL (if any)
  const recordedBlobs: Array<{ blob: Blob; name: string }> = []
  if (choices.saveRecording && state.recordingUrl) {
    try {
      const wavBlob = await blobFromObjectUrl(state.recordingUrl)
      recordedBlobs.push({ blob: wavBlob, name: 'recording' })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to read recorded audio blob', e)
    }
  }

  // Include combined mixdown if requested
  if (choices.saveCombined) {
    try {
      const combinedBlob = await renderCombinedMixdownWav()
      if (combinedBlob) recordedBlobs.push({ blob: combinedBlob, name: 'combined' })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to render combined mixdown', e)
    }
  }

  // 1) Upload all selected audio blobs
  const audioUrls = await Promise.all(recordedBlobs.map(({ blob, name }) => uploadAudio(user.id, blob, name)))

  // 2) Prepare settings
  const projectSettings = {
    bpm: state.bpm,
    mixerLevels: {
      track: state.trackVolume,
      metronome: state.metroVolume,
    },
    loopPoints: { start: 0, end: state.durationSec },
    trackUrls: audioUrls.filter(Boolean) as string[],
  }

  // 3) Insert project row with conflict-safe retry
  const insertOnce = async (name: string) =>
    supabase.from('Projects').insert({ name, settings: projectSettings, user_id: user.id })

  let { error } = await insertOnce(projectName)
  if (error && ((error as any).code === '23505' || (error as any).status === 409 || /duplicate key/i.test(error.message))) {
    const uniqueName = `${projectName}-${Date.now()}`
    const retry = await insertOnce(uniqueName)
    error = retry.error
  }

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving project:', error.message)
    return false
  }
  return true
}


