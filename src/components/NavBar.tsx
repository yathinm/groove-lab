type Props = {
  current: 'home' | 'profile'
  onNavigate: (page: 'home' | 'profile') => void
}

export default function NavBar({ current, onNavigate }: Props) {
  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #ccc',
    background: 'white',
    cursor: 'pointer',
    fontWeight: 600,
    color: '#000',
  }

  const nextPage = current === 'home' ? 'profile' : 'home'
  const label = nextPage === 'profile' ? 'Profile' : 'Home'

  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <button
        style={buttonStyle}
        onClick={() => onNavigate(nextPage)}
      >
        {label}
      </button>
    </nav>
  )
}


