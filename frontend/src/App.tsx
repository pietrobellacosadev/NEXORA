import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import MapaPage from './pages/MapaPage'
import PerfilPage from './pages/PerfilPage'
import AnalisesPage from './pages/AnalisesPage'
import InvestigarPage from './pages/InvestigarPage'
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
        <Route path="/"            element={<DashboardPage />} />
        <Route path="/mapa"        element={<MapaPage />} />
        <Route path="/perfil"      element={<PerfilPage />} />
        <Route path="/perfil/:id"  element={<PerfilPage />} />
        <Route path="/analises"    element={<AnalisesPage />} />
        <Route path="/investigar"  element={<InvestigarPage />} />
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
