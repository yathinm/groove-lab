import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'


type ProjectRow = {
  name: string
  settings: {
    trackUrls?: string[]
    bpm?: number | null
  }
}

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [files, setFiles] = useState<{ name: string; url: string }[]>([])

  useEffect(() => {
    let cancelled = false
    async function fetchProjects(uid: string) {
      try {
        const { data, error } = await supabase
          .from('Projects')
          .select('name,settings')
          .eq('user_id', uid)
          .order('name', { ascending: true })
        if (error) throw error
        if (!cancelled) setProjects((data as ProjectRow[]) || [])
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load projects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function fetchStorageFiles(email: string) {
      try {
        const folder = email.replace(/[^a-zA-Z0-9._-]+/g, '_') + '/'
        const { data, error } = await supabase.storage.from('Project-Audio').list(folder, { limit: 100, offset: 0 })
        if (error) throw error
        const items = (data || []).filter((i) => i.name.toLowerCase().endsWith('.wav'))
        const filesWithUrls = items.map((i) => {
          const path = folder + i.name
          const { data } = supabase.storage.from('Project-Audio').getPublicUrl(path)
          return { name: i.name, url: data.publicUrl }
        })
        if (!cancelled) setFiles(filesWithUrls)
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load files')
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      const uid = user?.id
      if (uid) {
        setLoading(true)
        void fetchProjects(uid)
        if (user?.email) void fetchStorageFiles(user.email)
      } else {
        setProjects([])
        setFiles([])
        setLoading(false)
      }
    })

    const poll = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) void fetchProjects(user.id)
      if (user?.email) void fetchStorageFiles(user.email)
    }, 5000)

    return () => {
      cancelled = true
      try { clearInterval(poll) } catch {}
    }
  }, [])

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3>Profile</h3>
      {loading && <p>Loading projects…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!loading && projects.length === 0 && <p>No saved projects yet.</p>}
      <div style={{ display: 'grid', gap: 16 }}>
        {projects.map((p) => (
          <div key={p.name} style={{ border: '1px solid #444', padding: 12, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{p.name}</strong>
            </div>
            {p.settings?.bpm != null && (
              <div style={{ marginTop: 6, opacity: 0.8 }}>BPM: {p.settings.bpm}</div>
            )}
            {Array.isArray(p.settings?.trackUrls) && p.settings.trackUrls.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {p.settings.trackUrls.map((url, i) => (
                  <div key={i} style={{ display: 'grid', gap: 4 }}>
                    <a href={url} target="_blank" rel="noreferrer">Track {i + 1}</a>
                    <audio src={url} controls preload="none" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {files.length > 0 && (
          <div style={{ border: '1px solid #444', padding: 12, borderRadius: 6 }}>
            <strong>Your Storage Files</strong>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {files.map((f) => (
                <div key={f.name} style={{ display: 'grid', gap: 4 }}>
                  <span>{f.name}</span>
                  <audio src={f.url} controls preload="none" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}


