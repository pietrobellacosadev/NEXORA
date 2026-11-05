import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PerfilPage from '../pages/PerfilPage'

// ── Mock do cliente HTTP ──────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

import api from '../lib/api'
const mockGet = vi.mocked(api.get)

// ── Fixtures ─────────────────────────────────────────────────────────────────
const MUNICIPIO_SP = {
  codigo_ibge: '3550308',
  nome: 'São Paulo',
  mesorregiao: 'Metropolitana de São Paulo',
  microrregiao: 'São Paulo',
  populacao_estimada: 11_451_245,
}

const PERFIL_SP = {
  municipio: MUNICIPIO_SP,
  mercado: [
    {
      chave: 'densidade_movel',
      nome: 'Densidade de acessos móveis',
      valor_num: 107.66,
      valor_txt: null,
      unidade: 'acessos/100 hab',
      fonte: 'ANATEL',
      periodo: '2023',
      tipo: 'oficial',
      limitacoes: null,
    },
    {
      chave: 'cobertura_5g',
      nome: 'Cobertura de rede 5G',
      valor_num: null,
      valor_txt: 'Não disponível',
      unidade: '% da área urbana',
      fonte: 'ANATEL / Teleco',
      periodo: '2023',
      tipo: 'indisponivel',
      limitacoes: '5G ainda não implantado.',
    },
  ],
  social: [
    {
      chave: 'idhm',
      nome: 'IDHM',
      valor_num: 0.77,
      valor_txt: null,
      unidade: 'índice (0–1)',
      fonte: 'PNUD / IBGE',
      periodo: '2021',
      tipo: 'oficial',
      limitacoes: null,
    },
  ],
}

const SUGESTOES = {
  municipios: [
    { codigo_ibge: '3550308', nome: 'São Paulo', regiao_administrativa: 'Metropolitana' },
    { codigo_ibge: '3509502', nome: 'Campinas', regiao_administrativa: 'Campinas' },
  ],
}

function renderPerfil(id?: string) {
  return render(
    <MemoryRouter initialEntries={[id ? `/perfil/${id}` : '/perfil']}>
      <Routes>
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/perfil/:id" element={<PerfilPage />} />
        <Route path="/investigar" element={<div>Investigar</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('PerfilPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza cabeçalho e campo de busca', () => {
    renderPerfil()
    expect(screen.getByText('Perfil Municipal')).toBeTruthy()
    expect(screen.getByPlaceholderText(/buscar município/i)).toBeTruthy()
  })

  it('mostra estado vazio sem município selecionado', () => {
    renderPerfil()
    expect(screen.getByText(/nenhum município selecionado/i)).toBeTruthy()
  })

  it('carrega perfil automaticamente quando há :id na rota', async () => {
    mockGet.mockResolvedValueOnce({ data: PERFIL_SP })

    renderPerfil('3550308')

    // Aguarda o h2 com o nome do município (usa role para ser preciso)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'São Paulo' })).toBeTruthy()
    })
    expect(mockGet).toHaveBeenCalledWith('/municipios/3550308/perfil')
  })

  it('exibe nome, mesorregião e população do município', async () => {
    mockGet.mockResolvedValueOnce({ data: PERFIL_SP })

    renderPerfil('3550308')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'São Paulo' })).toBeTruthy()
    )
    expect(screen.getByText(/metropolitana de são paulo/i)).toBeTruthy()
    expect(screen.getByText(/11\.451\.245 hab/i)).toBeTruthy()
  })

  it('exibe tabs de Mercado e Social com contadores', async () => {
    mockGet.mockResolvedValueOnce({ data: PERFIL_SP })

    renderPerfil('3550308')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'São Paulo' })).toBeTruthy()
    )
    expect(screen.getByText(/potencial de mercado/i)).toBeTruthy()
    expect(screen.getByText(/potencial social/i)).toBeTruthy()
  })

  it('exibe indicadores do pilar Mercado por padrão', async () => {
    mockGet.mockResolvedValueOnce({ data: PERFIL_SP })

    renderPerfil('3550308')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'São Paulo' })).toBeTruthy()
    )
    expect(screen.getByText('Densidade de acessos móveis')).toBeTruthy()
  })

  it('exibe badge Indisponível para indicador sem valor', async () => {
    mockGet.mockResolvedValueOnce({ data: PERFIL_SP })

    renderPerfil('3550308')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'São Paulo' })).toBeTruthy()
    )
    // 'Indisponível' aparece no badge do card e na nota de integridade
    expect(screen.getAllByText('Indisponível').length).toBeGreaterThan(0)
  })

  it('exibe sugestões ao digitar na busca', async () => {
    mockGet.mockResolvedValueOnce({ data: SUGESTOES })

    renderPerfil()
    const input = screen.getByPlaceholderText(/buscar município/i)
    fireEvent.change(input, { target: { value: 'São' } })

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/municipios?q='))
    })
  })

  it('exibe mensagem de erro quando perfil falha', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))

    renderPerfil('9999999')

    await waitFor(() => {
      expect(screen.getByText(/não foi possível carregar/i)).toBeTruthy()
    })
  })

  it('botão Investigar com IA navega para /investigar', async () => {
    mockGet.mockResolvedValueOnce({ data: PERFIL_SP })

    renderPerfil('3550308')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'São Paulo' })).toBeTruthy()
    )
    const btn = screen.getByRole('button', { name: /investigar com ia/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Investigar')).toBeTruthy()
    })
  })
})
