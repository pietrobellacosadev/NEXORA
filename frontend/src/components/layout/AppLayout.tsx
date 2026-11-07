import { type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import AIFab from '../ui/AIFab'
import './AppLayout.css'

interface AppLayoutProps {
  children: ReactNode
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

/** Rotas que precisam ocupar toda a largura disponível (sem container centrado). */
const FULL_BLEED_ROUTES = new Set(['/mapa'])

export default function AppLayout({ children, theme, onToggleTheme }: AppLayoutProps) {
  const { pathname } = useLocation()
  const isFullBleed = FULL_BLEED_ROUTES.has(pathname)

  return (
    <div className="app-layout">
      <TopBar theme={theme} onToggleTheme={onToggleTheme} />
      <main className={`app-layout__main${isFullBleed ? ' app-layout__main--full-bleed' : ''}`}>
        {isFullBleed ? (
          children
        ) : (
          <div className="app-layout__container">
            {children}
          </div>
        )}
      </main>
      <AIFab />
    </div>
  )
}
