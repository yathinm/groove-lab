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

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'white',
    borderBottom: '1px solid #eee',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end'
  }

  const nextPage = current === 'home' ? 'profile' : 'home'
  const label = nextPage === 'profile' ? 'Profile' : 'Home'

  return (
    <nav style={navStyle}>
      <button
        style={buttonStyle}
        onClick={() => onNavigate(nextPage)}
      >
        {label}
      </button>
    </nav>
  )
}


