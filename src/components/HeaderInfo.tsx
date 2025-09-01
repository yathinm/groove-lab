import { Music, Timer, Mic } from 'lucide-react'

export function HeaderInfo() {
  return (
    <header className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-orange-200">
      <div className="flex flex-wrap items-center gap-4">
        <div className="shrink-0 rounded-lg bg-orange-50 p-2 ring-1 ring-orange-100">
          <Music className="h-6 w-6 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0 flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Groove Lab</h1>
          <p className="text-sm text-slate-600">Upload a song, detect BPM, and practice with a synced metronome.</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
              <Timer className="h-3.5 w-3.5" /> BPM & Metronome
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
              <Mic className="h-3.5 w-3.5" /> Recording
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
              <Music className="h-3.5 w-3.5" /> Track Mixing
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}


