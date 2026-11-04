import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

describe('DashboardPage', () => {
  it('renderiza o título principal', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(screen.getByText(/dados reais/i)).toBeTruthy()
  })

  it('exibe os cards de funcionalidades', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(screen.getByText('Mapa Territorial')).toBeTruthy()
    expect(screen.getByText('Perfil Municipal')).toBeTruthy()
    expect(screen.getByText('Comparação')).toBeTruthy()
    expect(screen.getByText('Investigação por IA')).toBeTruthy()
  })

  it('exibe os stats', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(screen.getByText('645')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })
})
