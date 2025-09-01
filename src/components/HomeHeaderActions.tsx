import { LogOut, Save } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { handleSaveProject, type SaveChoices } from '../api/projects'

type Props = {
  disabled: boolean
}

export function HomeHeaderActions({ disabled }: Props) {
  return (
    <div className="flex items-center justify-end gap-3">
      <button
        className="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={async () => {
          const projectName = window.prompt('Project name?')?.trim()
          if (!projectName) return
          const choice = window.prompt('Save which audio? Type: recording, combined, or both')?.trim().toLowerCase()
          if (!choice) return
          const choices: SaveChoices = {
            saveRecording: choice === 'recording' || choice === 'both',
            saveCombined: choice === 'combined' || choice === 'both',
          }
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            alert('Please sign in to save projects.')
            return
          }
          const ok = await handleSaveProject(projectName, user, choices)
          alert(ok ? 'Project saved successfully!' : 'Failed to save project.')
        }}
        disabled={disabled}
      >
        <Save className="mr-2 h-4 w-4" /> Save Project
      </button>
      <button
        className="inline-flex items-center rounded-md border border-orange-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-orange-50"
        onClick={async () => {
          try { await supabase.auth.signOut() } catch {}
        }}
      >
        <LogOut className="mr-2 h-4 w-4" /> Log out
      </button>
    </div>
  )
}


