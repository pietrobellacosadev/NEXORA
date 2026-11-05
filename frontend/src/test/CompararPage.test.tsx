import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CompararPage from '../pages/CompararPage'

// ── Mock do cliente HTTP ──────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

import api from '../lib/api'
const mockGet = vi.mocked(api.get)

// ── Fixtures ─────────────────────────────────────────────────────────────────
const SUGESTOES_SP = {
  municipios: [
    { codigo_ibge: '3550308', nome: 'São Paulo', regiao_administrativa: 'Metropolitana' },
  ],
}

const SUGESTOES_CAMP = {
  municipios: [
    { codigo_ibge: '3509502', nome: 'Campinas', regiao_administrativa: 'Campinas' },
  ],
}

const _indicador = (chave: string, nome: string, valor: number, categoria: string) => ({
  chave,
  nome,
  valor_num: valor,
  valor_txt: null,
  unidade: categoria === 'mercado' ? 'acessos/100 hab' : '%',
  fonte: 'ANATEL',
  periodo: '2023',
  tipo: 'estimado',
  limitacoes: null,
})

const _perfil = (ibge: string, nome: string, dm: number, idhm: number) => ({
  municipio: { codigo_ibge: ibge, nome, mesorregiao: 'Teste', microrregiao: 'Teste', populacao_estimada: 50_000 },
  mercado: [_indicador('densidade_movel', 'Densidade de acessos móveis', dm, 'mercado')],
  social:  [_indicador('idhm', 'IDHM', idhm, 'social')],
})

function renderComparar() {
  return render(
    <MemoryRouter>
      <CompararPage />
    </MemoryRouter>
  )
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('CompararPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza cabeçalho e campo de busca', () => {
    renderComparar()
    expect(screen.getByText('Comparação Municipal')).toBeTruthy()
    expect(screen.getByPlaceholderText(/buscar e adicionar município/i)).toBeTruthy()
  })

  it('mostra estado vazio sem municípios selecionados', () => {
    renderComparar()
    expect(screen.getByText(/nenhum município selecionado/i)).toBeTruthy()
  })

  it('mostra hint de quantos municípios podem ser adicionados', () => {
    renderComparar()
    expect(screen.getByText(/adicione até 4/i)).toBeTruthy()
  })

  it('busca sugestões ao digitar', async () => {
    mockGet.mockResolvedValueOnce({ data: SUGESTOES_SP })

    renderComparar()
    const input = screen.getByPlaceholderText(/buscar e adicionar município/i)
    fireEvent.change(input, { target: { value: 'São' } })

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/municipios?q='))
    })
  })

  it('exibe sugestões retornadas pela API', async () => {
    mockGet.mockResolvedValueOnce({ data: SUGESTOES_SP })

    renderComparar()
    fireEvent.change(
      screen.getByPlaceholderText(/buscar e adicionar município/i),
      { target: { value: 'São' } }
    )

    await waitFor(() => {
      expect(screen.getByText('São Paulo')).toBeTruthy()
    })
  })

  it('adiciona município ao clicar na sugestão', async () => {
    // 1ª chamada: busca sugestões; 2ª: carrega perfil
    mockGet
      .mockResolvedValueOnce({ data: SUGESTOES_SP })
      .mockResolvedValueOnce({ data: _perfil('3550308', 'São Paulo', 107.66, 0.77) })

    renderComparar()
    fireEvent.change(
      screen.getByPlaceholderText(/buscar e adicionar município/i),
      { target: { value: 'São' } }
    )

    const sugestao = await screen.findByText('São Paulo')
    fireEvent.click(sugestao)

    await waitFor(() => {
      // Chip do município selecionado
      expect(screen.getAllByText('São Paulo').length).toBeGreaterThan(0)
    })
  })

  it('exibe tabela comparativa após adicionar municípios', async () => {
    mockGet
      .mockResolvedValueOnce({ data: SUGESTOES_SP })
      .mockResolvedValueOnce({ data: _perfil('3550308', 'São Paulo', 107.66, 0.77) })

    renderComparar()
    fireEvent.change(
      screen.getByPlaceholderText(/buscar e adicionar município/i),
      { target: { value: 'São' } }
    )
    fireEvent.click(await screen.findByText('São Paulo'))

    await waitFor(() => {
      expect(screen.getByText(/potencial de mercado/i)).toBeTruthy()
      expect(screen.getByText(/potencial social/i)).toBeTruthy()
    })
  })

  it('remove município ao clicar no X do chip', async () => {
    mockGet
      .mockResolvedValueOnce({ data: SUGESTOES_SP })
      .mockResolvedValueOnce({ data: _perfil('3550308', 'São Paulo', 107.66, 0.77) })

    renderComparar()
    fireEvent.change(
      screen.getByPlaceholderText(/buscar e adicionar município/i),
      { target: { value: 'São' } }
    )
    fireEvent.click(await screen.findByText('São Paulo'))

    // Aguarda o chip aparecer
    await waitFor(() => {
      expect(screen.getByLabelText(/remover são paulo/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText(/remover são paulo/i))

    await waitFor(() => {
      expect(screen.getByText(/nenhum município selecionado/i)).toBeTruthy()
    })
  })

  it('exibe tabs de Mercado e Social após adicionar município', async () => {
    mockGet
      .mockResolvedValueOnce({ data: SUGESTOES_SP })
      .mockResolvedValueOnce({ data: _perfil('3550308', 'São Paulo', 107.66, 0.77) })

    renderComparar()
    fireEvent.change(
      screen.getByPlaceholderText(/buscar e adicionar município/i),
      { target: { value: 'São' } }
    )
    fireEvent.click(await screen.findByText('São Paulo'))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /mercado/i })).toBeTruthy()
      expect(screen.getByRole('tab', { name: /social/i })).toBeTruthy()
    })
  })

  it('exibe mensagem de erro quando o perfil falha ao carregar', async () => {
    mockGet
      .mockResolvedValueOnce({ data: SUGESTOES_SP })
      .mockRejectedValueOnce(new Error('Network error'))

    renderComparar()
    fireEvent.change(
      screen.getByPlaceholderText(/buscar e adicionar município/i),
      { target: { value: 'São' } }
    )
    fireEvent.click(await screen.findByText('São Paulo'))

    await waitFor(() => {
      expect(screen.getByText(/não foi possível carregar/i)).toBeTruthy()
    })
  })
})
