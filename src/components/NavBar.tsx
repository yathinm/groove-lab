import { Home as HomeIcon, User as UserIcon } from 'lucide-react'
import { useAppConfig } from '../config/ConfigProvider'

type Props = {
  current: 'home' | 'profile'
  onNavigate: (page: 'home' | 'profile') => void
}

export default function NavBar({ current, onNavigate }: Props) {
  const cfg = useAppConfig()
  const navStyle: React.CSSProperties = {
    position: 'static',
    zIndex: 1,
    background: 'transparent',
  }

  const showTarget: 'home' | 'profile' = current === 'home' ? 'profile' : 'home'
  const Icon = showTarget === 'home' ? HomeIcon : UserIcon
  const label = showTarget === 'home' ? 'Go to Home' : 'Go to Profile'

  return (
    <nav style={navStyle}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`flex ${cfg.ui.navHeight} items-center justify-between`}>
          <div className="flex items-center gap-2">
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label={label}
              className={`inline-flex ${cfg.ui.circleButtonSize} items-center justify-center rounded-full bg-orange-600 text-white shadow hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600`}
              onClick={() => onNavigate(showTarget)}
            >
              <Icon className={cfg.ui.iconSizeMd} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}


