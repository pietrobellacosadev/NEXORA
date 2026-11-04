import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

describe('DashboardPage', () => {
  it('renderiza o título NEXORA', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    expect(screen.getAllByText('NEXORA').length).toBeGreaterThan(0)
  })

  it('exibe os links de navegação principais', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Mapa Territorial')).toBeTruthy()
    expect(screen.getByText('Perfil Municipal')).toBeTruthy()
    expect(screen.getByText('Comparação')).toBeTruthy()
    expect(screen.getByText('Investigação por IA')).toBeTruthy()
  })
})
