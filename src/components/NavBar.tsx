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
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'saturate(180%) blur(10px)',
    WebkitBackdropFilter: 'saturate(180%) blur(10px)',
    borderBottom: '1px solid #eee',
  }

  const linkBase = 'inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold'
  const inactive = linkBase + ' text-gray-700 hover:bg-gray-100'
  const active = linkBase + ' text-teal-700 bg-teal-50 ring-1 ring-inset ring-teal-200'

  return (
    <nav style={navStyle}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="text-sm font-extrabold tracking-tight text-gray-900">Groove Lab</div>
          <div className="flex items-center gap-2">
            <button className={current === 'home' ? active : inactive} onClick={() => onNavigate('home')}>Home</button>
            <button className={current === 'profile' ? active : inactive} onClick={() => onNavigate('profile')}>Profile</button>
          </div>
        </div>
      </div>
    </nav>
  )
}


