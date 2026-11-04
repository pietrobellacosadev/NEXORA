import { NavLink } from 'react-router-dom'
import {
  Map,
  BarChart2,
  GitCompare,
  MessageSquare,
  Sun,
  Moon,
} from 'lucide-react'
import './TopBar.css'

interface TopBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const NAV_ITEMS = [
  { to: '/',          label: 'Mapa',       icon: Map },
  { to: '/perfil',    label: 'Perfil',     icon: BarChart2 },
  { to: '/comparar',  label: 'Comparação', icon: GitCompare },
  { to: '/investigar',label: 'Investigar', icon: MessageSquare },
]

export default function TopBar({ theme, onToggleTheme }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {/* Marca */}
        <div className="topbar__brand">
          <div className="topbar__logo" aria-hidden="true">
            <i />
            <i />
          </div>
          <div>
            <span className="topbar__name">NEXORA</span>
            <span className="topbar__tagline">Inteligência territorial · SP</span>
          </div>
        </div>

        {/* Navegação principal */}
        <nav className="topbar__nav" aria-label="Navegação principal">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `topbar__navlink${isActive ? ' topbar__navlink--active' : ''}`
              }
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Ações */}
        <div className="topbar__actions">
          <button
            className="topbar__icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
