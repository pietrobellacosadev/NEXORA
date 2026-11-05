import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Map, BarChart2, GitCompare, MessageSquare,
  Sun, Moon,
} from 'lucide-react'
import './TopBar.css'

interface TopBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const NAV_ITEMS = [
  { to: '/mapa',       label: 'Mapa',        icon: Map         },
  { to: '/perfil',     label: 'Perfil',      icon: BarChart2   },
  { to: '/comparar',   label: 'Comparação',  icon: GitCompare  },
  { to: '/investigar', label: 'Investigar',  icon: MessageSquare },
]

export default function TopBar({ theme, onToggleTheme }: TopBarProps) {
  const location = useLocation()

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
              width="28"
              height="28"
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
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`topbar__link${active ? ' topbar__link--active' : ''}`}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
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
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to)
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
