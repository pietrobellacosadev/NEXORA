import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvestigarPage from '../pages/InvestigarPage'

// ── Mock do cliente HTTP ──────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

import api from '../lib/api'
const mockPost = vi.mocked(api.post)

// ── Fixture de resultado ─────────────────────────────────────────────────────
const RESULTADO_MOCK = {
  municipio: 'São Paulo',
  codigo_ibge: '3550308',
  pergunta: 'Quais são as oportunidades de conectividade?',
  sintese: 'São Paulo apresenta alto potencial de mercado e social.',
  conclusao: 'Município prioritário para expansão.',
  convergencias: ['Alta urbanização', 'Demanda reprimida'],
  divergencias: ['Concentração de investimento na capital'],
  dados_insuficientes: [],
  fontes_consultadas: ['ANATEL', 'PNUD'],
  mercado: {
    agente: 'market',
    municipio: 'São Paulo',
    codigo_ibge: '3550308',
    constatacoes: ['Boa cobertura 4G', 'PIB per capita elevado'],
    fontes: ['ANATEL'],
    limitacoes: [],
    dados_ausentes: [],
  },
  social: {
    agente: 'social',
    municipio: 'São Paulo',
    codigo_ibge: '3550308',
    constatacoes: ['IDHM elevado', 'Alta taxa de alfabetização'],
    fontes: ['PNUD'],
    limitacoes: [],
    dados_ausentes: [],
  },
  is_ia: true,
}

function renderInvestigar(municipio?: string, nome?: string) {
  const search = municipio
    ? `?municipio=${municipio}&nome=${encodeURIComponent(nome ?? '')}`
    : ''
  return render(
    <MemoryRouter initialEntries={[`/investigar${search}`]}>
      <InvestigarPage />
    </MemoryRouter>
  )
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('InvestigarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza título e formulário', () => {
    renderInvestigar()
    expect(screen.getByText('Investigação por IA')).toBeTruthy()
    // Campo município tem label "Município"
    expect(screen.getByLabelText(/município/i)).toBeTruthy()
    expect(screen.getByLabelText(/pergunta de investigação/i)).toBeTruthy()
  })

  it('pré-preenche nome do município a partir de query params', () => {
    renderInvestigar('3550308', 'São Paulo')
    // Quando há params, o município é exibido como pill (não input)
    expect(screen.getByText('São Paulo')).toBeTruthy()
    // O código IBGE aparece no pill
    expect(screen.getByText('3550308')).toBeTruthy()
  })

  it('botão Investigar está desabilitado sem código e pergunta preenchidos', () => {
    renderInvestigar()
    const btn = screen.getByRole('button', { name: /investigar/i })
    expect(btn).toBeDisabled()
  })

  it('botão Investigar fica habilitado com município e pergunta válidos', async () => {
    // Fornece município via params — já começa com município resolvido
    renderInvestigar('3550308', 'São Paulo')

    fireEvent.change(screen.getByLabelText(/pergunta de investigação/i), {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })

    const btn = screen.getByRole('button', { name: /investigar/i })
    expect(btn).not.toBeDisabled()
  })

  it('exibe fluxo dos agentes durante investigação', async () => {
    // Post nunca resolve — mantém estado loading
    mockPost.mockImplementation(() => new Promise(() => {}))

    renderInvestigar('3550308', 'São Paulo')
    fireEvent.change(screen.getByLabelText(/pergunta de investigação/i), {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /investigar/i }))

    await waitFor(() => {
      expect(screen.getByText(/agente de mercado/i)).toBeTruthy()
      expect(screen.getByText(/agente social/i)).toBeTruthy()
      expect(screen.getByText(/agente consolidador/i)).toBeTruthy()
    })
  })

  it('exibe síntese e conclusão após resultado retornar', async () => {
    mockPost.mockResolvedValueOnce({ data: RESULTADO_MOCK })

    renderInvestigar('3550308', 'São Paulo')
    fireEvent.change(screen.getByLabelText(/pergunta de investigação/i), {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /investigar/i }))

    await waitFor(() => {
      expect(screen.getByText(/são paulo apresenta alto potencial/i)).toBeTruthy()
    })
    expect(screen.getByText(/município prioritário/i)).toBeTruthy()
  })

  it('exibe convergências quando presentes no resultado', async () => {
    mockPost.mockResolvedValueOnce({ data: RESULTADO_MOCK })

    renderInvestigar('3550308', 'São Paulo')
    fireEvent.change(screen.getByLabelText(/pergunta de investigação/i), {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /investigar/i }))

    await waitFor(() => {
      expect(screen.getByText('Convergências')).toBeTruthy()
    })
    expect(screen.getByText('Alta urbanização')).toBeTruthy()
  })

  it('exibe divergências quando presentes no resultado', async () => {
    mockPost.mockResolvedValueOnce({ data: RESULTADO_MOCK })

    renderInvestigar('3550308', 'São Paulo')
    fireEvent.change(screen.getByLabelText(/pergunta de investigação/i), {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /investigar/i }))

    await waitFor(() => {
      expect(screen.getByText('Divergências')).toBeTruthy()
    })
  })

  it('exibe mensagem de erro quando a API falha', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { detail: 'Município não encontrado.' } },
    })

    renderInvestigar('9999999', 'Inexistente')
    fireEvent.change(screen.getByLabelText(/pergunta de investigação/i), {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /investigar/i }))

    await waitFor(() => {
      expect(screen.getByText(/município não encontrado/i)).toBeTruthy()
    })
  })

  it('dispara investigação ao pressionar Enter na pergunta', async () => {
    mockPost.mockResolvedValueOnce({ data: RESULTADO_MOCK })

    renderInvestigar('3550308', 'São Paulo')
    const inputPergunta = screen.getByLabelText(/pergunta de investigação/i)
    fireEvent.change(inputPergunta, {
      target: { value: 'Quais são as oportunidades de conectividade?' },
    })
    fireEvent.keyDown(inputPergunta, { key: 'Enter' })

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/investigar', expect.objectContaining({
        codigo_ibge: '3550308',
      }))
    })
  })
})
