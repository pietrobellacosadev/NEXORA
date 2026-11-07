import { type ReactNode } from 'react'
import TopBar from './TopBar'
import AIFab from '../ui/AIFab'
import './AppLayout.css'

interface AppLayoutProps {
  children: ReactNode
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function AppLayout({ children, theme, onToggleTheme }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <TopBar theme={theme} onToggleTheme={onToggleTheme} />
      <main className="app-layout__main">
        <div className="app-layout__container">
          {children}
        </div>
      </main>
      <AIFab />
    </div>
  )
}
