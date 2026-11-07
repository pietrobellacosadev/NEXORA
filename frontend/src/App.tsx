import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import AppLayout from './components/layout/AppLayout'
import InicioPage from './pages/InicioPage'
import MapaPage from './pages/MapaPage'
import DashboardPage from './pages/DashboardPage'
import CompararPage from './pages/CompararPage'
import AnalisesPage from './pages/AnalisesPage'
import NotFoundPage from './pages/NotFoundPage'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nexora-theme') as Theme | null
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/* Wrapper separado para ter acesso ao useLocation dentro do BrowserRouter */
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"            element={<InicioPage />} />
        <Route path="/mapa"        element={<MapaPage />} />
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/comparar"    element={<CompararPage />} />
        <Route path="/analises"    element={<AnalisesPage />} />
        <Route path="*"            element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nexora-theme', theme)
  }, [theme])

  const toggleTheme = () =>
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <BrowserRouter>
      <AppLayout theme={theme} onToggleTheme={toggleTheme}>
        <AnimatedRoutes />
      </AppLayout>
    </BrowserRouter>
  )
}
