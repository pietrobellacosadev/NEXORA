/**
 * E2E — 04 Fluxo de investigação com agentes IA + tratamento de erros
 *
 * Cobre:
 *   7. Fluxo de investigação com os três agentes (via mock — sem chamar GroqCloud)
 *   8. Tratamento de erros e indisponibilidade da API
 */

import { test, expect } from '@playwright/test'
import { registrarMocks } from './fixtures/mock-handlers'
import { MUNICIPIO_A, RESULTADO_INVESTIGACAO } from './fixtures/dados-teste'

const CODIGO_IBGE = MUNICIPIO_A.codigo_ibge   // '3500105'
const PERGUNTA    = 'Quais são as oportunidades de conectividade neste município?'

test.describe('Fluxo de investigação (mock da GroqCloud)', () => {
  test.beforeEach(async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/investigar')
  })

  test('deve exibir formulário de investigação com campos obrigatórios', async ({ page }) => {
    await expect(page.getByLabel(/Código IBGE/i)).toBeVisible()
    await expect(page.getByLabel(/Pergunta de investigação/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Investigar/i })).toBeVisible()
  })

  test('deve manter botão desabilitado enquanto campos estão incompletos', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Investigar/i })
    await expect(btn).toBeDisabled()

    // Só código IBGE — ainda desabilitado
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await expect(btn).toBeDisabled()
  })

  test('deve habilitar botão ao preencher código IBGE + pergunta mínima', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    await expect(page.getByRole('button', { name: /Investigar/i })).toBeEnabled()
  })

  test('deve exibir fluxo de agentes ao iniciar investigação', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    await page.getByRole('button', { name: /Investigar/i }).click()

    // Enquanto processa, os agentes aparecem
    await expect(page.getByText('Agente de Mercado')).toBeVisible()
    await expect(page.getByText('Agente Social')).toBeVisible()
    await expect(page.getByText('Agente Consolidador')).toBeVisible()
  })

  test('deve exibir resultado consolidado após investigação', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    // Registra a espera ANTES do click para não perder o evento
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise
    await expect(page.getByText(RESULTADO_INVESTIGACAO.sintese)).toBeVisible()
  })

  test('deve exibir conclusão do consolidador no resultado', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise
    await expect(page.getByText(RESULTADO_INVESTIGACAO.conclusao)).toBeVisible()
  })

  test('deve exibir seções Mercado e Social no resultado', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise
    await expect(page.getByText('Potencial de Mercado')).toBeVisible()
    await expect(page.getByText('Potencial Social')).toBeVisible()
  })

  test('deve exibir convergências e divergências no resultado', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise
    await expect(page.getByText('Convergências')).toBeVisible()
    await expect(page.getByText('Divergências')).toBeVisible()
  })

  test('deve exibir fontes consultadas no resultado', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise
    await expect(page.getByText(/Fontes consultadas:/i)).toBeVisible()
  })

  test('deve exibir badge "Gerado por IA" no resultado', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise
    await expect(page.getByText('Gerado por IA')).toBeVisible()
  })

  test('deve preencher código IBGE quando vindo de ?municipio=...', async ({ page }) => {
    await page.goto(`/investigar?municipio=${CODIGO_IBGE}&nome=${encodeURIComponent(MUNICIPIO_A.nome)}`)
    await expect(page.getByLabel(/Código IBGE/i)).toHaveValue(CODIGO_IBGE)
    await expect(page.getByText(MUNICIPIO_A.nome)).toBeVisible()
  })

  test('deve submeter investigação ao pressionar Enter no campo pergunta', async ({ page }) => {
    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    const inputPergunta = page.getByLabel(/Pergunta de investigação/i)
    await inputPergunta.fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await inputPergunta.press('Enter')
    await respostaPromise
    await expect(page.getByText(RESULTADO_INVESTIGACAO.sintese)).toBeVisible()
  })
})

test.describe('Tratamento de erros e indisponibilidade da API', () => {
  test('deve exibir mensagem de erro quando a API de investigação retorna 503', async ({ page }) => {
    await registrarMocks(page, { apiOffline: true })
    await page.goto('/investigar')

    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise

    // Deve exibir mensagem de erro (área de erro visível)
    const erroEl = page.locator('.inv__error')
    await expect(erroEl).toBeVisible()
  })

  test('deve exibir mensagem de erro quando perfil municipal retorna 503', async ({ page }) => {
    await registrarMocks(page, { apiOffline: true })
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.goto(`/perfil/${MUNICIPIO_A.codigo_ibge}`)
    await respostaPromise

    // Deve exibir erro no perfil
    const erroEl = page.locator('.perfil__error')
    await expect(erroEl).toBeVisible()
    await expect(erroEl).toContainText('Não foi possível carregar')
  })

  test('deve exibir estado vazio na comparação quando API está offline', async ({ page }) => {
    await registrarMocks(page, { apiOffline: true })
    await page.goto('/comparar')

    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))

    // Com API offline, sugestões não aparecem — estado vazio persiste
    await expect(page.getByRole('heading', { name: 'Nenhum município selecionado' })).toBeVisible()
  })

  test('aplicação não deve travar ou mostrar tela branca em erro de API', async ({ page }) => {
    await registrarMocks(page, { apiOffline: true })
    await page.goto('/investigar')

    await page.getByLabel(/Código IBGE/i).fill(CODIGO_IBGE)
    await page.getByLabel(/Pergunta de investigação/i).fill(PERGUNTA)
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/investigar') && r.request().method() === 'POST',
      { timeout: 15_000 }
    )
    await page.getByRole('button', { name: /Investigar/i }).click()
    await respostaPromise

    // Formulário ainda deve estar presente (sem tela branca)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Investigação por IA')
    // Botão volta a ficar habilitado após o erro
    await expect(page.getByRole('button', { name: /Investigar/i })).toBeEnabled()
  })
})
