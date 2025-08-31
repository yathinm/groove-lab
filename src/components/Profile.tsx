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

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setProjects([])
          return
        }
        const { data, error } = await supabase
          .from('Projects')
          .select('name,settings')
          .eq('user_id', user.id)
          .order('name', { ascending: true })
        if (error) throw error
        if (!cancelled) setProjects((data as ProjectRow[]) || [])
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load projects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
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
      </div>
    </section>
  )
}


