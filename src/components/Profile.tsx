import { Trash2, Loader2, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SavedTrackRow } from './SavedTrackRow'
import { defaultConfig } from '../config/constants'


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
    }, defaultConfig.polling.profileIntervalMs)

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
      {loading && (
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-orange-200">
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
          <span className="text-sm font-medium text-gray-700">Loading projects…</span>
        </div>
      )}
      {error && <p className="rounded-md bg-orange-50 p-2 text-sm font-medium text-orange-700 ring-1 ring-inset ring-orange-200">{error}</p>}
      {!loading && projects.length === 0 && (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-orange-200">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 ring-1 ring-inset ring-orange-200">
            <FolderOpen className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-sm font-semibold text-slate-900">No saved projects yet</div>
          <div className="mt-1 text-xs text-gray-600">Save a project from the Home page to see it here.</div>
        </div>
      )}
      <div className="grid gap-4">
        {projects.map((p) => (
          <div key={p.name} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-orange-200">
            <div className="flex items-center justify-between">
              <strong className="text-slate-900">{p.name}</strong>
              <button
                className="inline-flex items-center rounded-md border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-orange-50"
                onClick={() => void handleDeleteProject(p.name)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </button>
            </div>
            {p.settings?.bpm != null && (
              <div className="mt-2">
                <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200">BPM {p.settings.bpm}</span>
              </div>
            )}
            {Array.isArray(p.settings?.trackUrls) && p.settings.trackUrls.length > 0 && (
              <div className="mt-3 grid gap-3">
                {p.settings.trackUrls.map((url, i) => (
                  <SavedTrackRow key={i} url={url} index={i} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}



// Moved SavedTrackRow to its own component
