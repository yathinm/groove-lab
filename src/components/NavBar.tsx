type Props = {
  current: 'home' | 'profile'
  onNavigate: (page: 'home' | 'profile') => void
}

export default function NavBar({ current, onNavigate }: Props) {
  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: '#1E1E2E',
    borderBottom: '1px solid #2A2A3A',
  }

  const linkBase = 'inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold'
  const inactive = linkBase + ' text-slate-200 hover:bg-slate-700/30'
  const active = linkBase + ' text-white bg-slate-700/50 ring-1 ring-inset ring-slate-600'

  return (
    <nav style={navStyle}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="text-sm font-bold tracking-tight text-white">Groove Lab</div>
          <div className="flex items-center gap-2">
            <button className={current === 'home' ? active : inactive} onClick={() => onNavigate('home')}>Home</button>
            <button className={current === 'profile' ? active : inactive} onClick={() => onNavigate('profile')}>Profile</button>
          </div>
        </div>
      </div>
    </nav>
  )
}


