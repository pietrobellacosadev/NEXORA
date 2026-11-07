import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  Home, Map, BarChart3,
  Sun, Moon, Clock, GitCompare,
} from 'lucide-react'
import { ANALISES_STORAGE_KEY } from '../../pages/AnalisesPage'
import './TopBar.css'

interface TopBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const NAV_ITEMS = [
  { to: '/',          label: 'Início',    icon: Home,       exact: true  },
  { to: '/mapa',      label: 'Mapa',      icon: Map,        exact: false },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3,  exact: false },
  { to: '/comparar',  label: 'Comparar',  icon: GitCompare, exact: false },
  { to: '/analises',  label: 'Análises',  icon: Clock,      exact: false },
]

export default function TopBar({ theme, onToggleTheme }: TopBarProps) {
  const location = useLocation()
  const [analiseCount, setAnaliseCount] = useState(0)

  useEffect(() => {
    function lerCount() {
      try {
        const lista = JSON.parse(localStorage.getItem(ANALISES_STORAGE_KEY) ?? '[]')
        setAnaliseCount(Array.isArray(lista) ? lista.length : 0)
      } catch { setAnaliseCount(0) }
    }
    lerCount()
    window.addEventListener('storage', lerCount)
    // Também relê ao focar a janela (útil quando salva numa aba e volta para outra)
    window.addEventListener('focus', lerCount)
    return () => {
      window.removeEventListener('storage', lerCount)
      window.removeEventListener('focus', lerCount)
    }
  }, [])

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          {/* Marca */}
          <NavLink to="/" className="topbar__brand" aria-label="NEXORA — Início">
            <img
                src="/nexora-icon.svg"
                alt="NEXORA"
                className="topbar__logo-img"
                width="46"
                height="46"
              />
            <div className="topbar__brand-text">
              <span className="topbar__name">NEXORA</span>
              <span className="topbar__tagline">Inteligência territorial</span>
            </div>
          </NavLink>

          {/* Separador */}
          <div className="topbar__divider" aria-hidden="true" />

          {/* Navegação */}
          <nav className="topbar__nav" aria-label="Navegação principal">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`topbar__link${active ? ' topbar__link--active' : ''}`}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
                  {to === '/analises' && analiseCount > 0 && (
                    <span className="topbar__nav-badge">{analiseCount > 99 ? '99+' : analiseCount}</span>
                  )}
                  {active && (
                    <motion.span
                      className="topbar__link-indicator"
                      layoutId="nav-indicator"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Ações */}
          <div className="topbar__actions">
            <motion.button
              className="topbar__action-btn"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              whileTap={{ scale: 0.90 }}
              whileHover={{ scale: 1.06 }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Bottom navigation — mobile only */}
      <nav className="bottom-nav" aria-label="Navegação mobile">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const active = exact
            ? location.pathname === to
            : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`bottom-nav__item${active ? ' bottom-nav__item--active' : ''}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
