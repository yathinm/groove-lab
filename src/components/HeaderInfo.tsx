import AnimatedTitle from './AnimatedTitle'

export function HeaderInfo() {
  return (
    <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="relative h-[56px] sm:h-[68px]">
          <AnimatedTitle texts={["GROOVE","LAB"]} className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight" />
        </div>
        <p className="text-sm text-white/90">Upload a song, detect BPM, and practice with a synced metronome.</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs font-semibold ring-1 ring-white/25">BPM Detection</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs font-semibold ring-1 ring-white/25">Metronome</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs font-semibold ring-1 ring-white/25">Record</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs font-semibold ring-1 ring-white/25">Mix</span>
        </div>
      </div>
    </header>
  )
}


