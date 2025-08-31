type Props = {
  current: 'home' | 'profile'
  onNavigate: (page: 'home' | 'profile') => void
}

export default function NavBar({ current, onNavigate }: Props) {
  const baseBtn: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #ccc',
    background: 'white',
    cursor: 'pointer',
  }
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    fontWeight: 700,
    borderColor: '#888',
  }

  return (
    <nav style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={current === 'home' ? activeBtn : baseBtn}
          onClick={() => onNavigate('home')}
        >
          Home
        </button>
        <button
          style={current === 'profile' ? activeBtn : baseBtn}
          onClick={() => onNavigate('profile')}
        >
          Profile
        </button>
      </div>
    </nav>
  )
}


