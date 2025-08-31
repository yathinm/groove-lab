import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { store } from '../store'

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
    .from('project-audio')
    .upload(filePath, audioBlob, { contentType: 'audio/wav', cacheControl: '3600', upsert: false })

  if (uploadError) {
    // eslint-disable-next-line no-console
    console.error('Error uploading audio:', uploadError.message)
    return null
  }

  const { data } = supabase.storage
    .from('project-audio')
    .getPublicUrl(filePath)

  return data.publicUrl
}

export async function handleSaveProject(projectName: string, user: User): Promise<boolean> {
  const state = store.getState().audio

  // Gather latest recorded WAV from in-memory URL (if any)
  const recordedBlobs: Array<{ blob: Blob; name: string }> = []
  if (state.recordingUrl) {
    try {
      const wavBlob = await blobFromObjectUrl(state.recordingUrl)
      recordedBlobs.push({ blob: wavBlob, name: 'recording' })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to read recorded audio blob', e)
    }
  }

  // 1) Upload all recorded audio blobs
  const audioUrls = await Promise.all(
    recordedBlobs.map(({ blob, name }) => uploadAudio(user.id, blob, name))
  )

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

  // 3) Insert project row
  const { error } = await supabase.from('projects').insert({
    name: projectName,
    settings: projectSettings,
    user_id: user.id,
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving project:', error.message)
    return false
  }
  return true
}


