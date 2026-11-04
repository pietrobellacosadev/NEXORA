import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import MapaPage from './pages/MapaPage'
import PerfilPage from './pages/PerfilPage'
import CompararPage from './pages/CompararPage'
import InvestigarPage from './pages/InvestigarPage'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('nexora-theme') as Theme | null
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
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
        <Routes>
          <Route path="/"            element={<DashboardPage />} />
          <Route path="/mapa"        element={<MapaPage />} />
          <Route path="/perfil"      element={<PerfilPage />} />
          <Route path="/perfil/:id"  element={<PerfilPage />} />
          <Route path="/comparar"    element={<CompararPage />} />
          <Route path="/investigar"  element={<InvestigarPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
