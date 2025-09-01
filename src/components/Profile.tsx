import { Trash2 } from 'lucide-react'
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

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      const uid = user?.id
      if (uid) {
        setLoading(true)
        void fetchProjects(uid)
      } else {
        setProjects([])
        setLoading(false)
      }
    })

    const poll = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) void fetchProjects(user.id)
    }, 5000)

    return () => {
      cancelled = true
      try { clearInterval(poll) } catch {}
    }
  }, [])

  function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]+/g, '_')
  }

  async function handleDeleteProject(name: string) {
    const ok = window.confirm(`Delete "${name}"? This will remove the database row and audio files.`)
    if (!ok) return
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const email = user.email || 'unknown'
      const folder = sanitizeName(email) + '/'
      const base = sanitizeName(name)
      const paths = [`${folder}${base}.wav`, `${folder}${base}-combined.wav`]
      try { await supabase.storage.from('Project-Audio').remove(paths) } catch {}
      const { error } = await supabase
        .from('Projects')
        .delete()
        .eq('user_id', user.id)
        .eq('name', name)
        .select()
      if (error) throw error
      setProjects((prev) => prev.filter((p) => p.name !== name))
    } catch (e) {
      setError((e as Error).message || 'Failed to delete')
    }
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Profile</h3>
      {loading && <p className="text-sm text-slate-300">Loading projects…</p>}
      {error && <p className="rounded-md bg-rose-50 p-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
      {!loading && projects.length === 0 && <p className="text-sm text-gray-600">No saved projects yet.</p>}
      <div className="grid gap-4">
        {projects.map((p) => (
          <div key={p.name} className="rounded-xl bg-card-bg p-4 shadow-sm ring-1 ring-slate-700/50">
            <div className="flex items-center justify-between">
              <strong className="text-white">{p.name}</strong>
              <button
                className="inline-flex items-center rounded-md border border-slate-600 bg-card-bg px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm hover:bg-slate-700/40"
                onClick={() => void handleDeleteProject(p.name)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </button>
            </div>
            {p.settings?.bpm != null && (
              <div className="mt-2 text-sm text-slate-300">BPM: {p.settings.bpm}</div>
            )}
            {Array.isArray(p.settings?.trackUrls) && p.settings.trackUrls.length > 0 && (
              <div className="mt-3 grid gap-2">
                {p.settings.trackUrls.map((url, i) => (
                  <div key={i} className="grid gap-1">
                    <a className="text-sm font-medium text-indigo-400 hover:underline" href={url} target="_blank" rel="noreferrer">Track {i + 1}</a>
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


