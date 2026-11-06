import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InicioPage from '../pages/InicioPage'

describe('InicioPage', () => {
  it('renderiza o título principal', () => {
    render(<MemoryRouter><InicioPage /></MemoryRouter>)
    expect(screen.getByText(/dados reais/i)).toBeTruthy()
  })

  it('exibe os cards de funcionalidades', () => {
    render(<MemoryRouter><InicioPage /></MemoryRouter>)
    expect(screen.getByText('Mapa Territorial')).toBeTruthy()
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Análises Recentes')).toBeTruthy()
    expect(screen.getByText('Investigação por IA')).toBeTruthy()
  })

  it('exibe os stats', () => {
    render(<MemoryRouter><InicioPage /></MemoryRouter>)
    expect(screen.getByText('645')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })
})
