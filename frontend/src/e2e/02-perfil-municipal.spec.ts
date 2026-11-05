/**
 * E2E — 02 Pesquisa e seleção de municípios / Perfil municipal
 *
 * Cobre:
 *   4. Pesquisa e seleção de municípios
 *   5. Exibição do perfil municipal
 */

import { test, expect } from '@playwright/test'
import { registrarMocks } from './fixtures/mock-handlers'
import { MUNICIPIO_A, PERFIL_A } from './fixtures/dados-teste'

test.describe('Busca de municípios na PerfilPage', () => {
  test.beforeEach(async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/perfil')
  })

  test('deve exibir estado vazio ao acessar /perfil sem ID', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nenhum município selecionado' })).toBeVisible()
    await expect(page.getByText('Use a busca acima')).toBeVisible()
  })

  test('deve exibir campo de busca acessível', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /Buscar município/i })
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()
  })

  test('deve exibir sugestões ao digitar no campo de busca', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município/i }).fill('Ada')
    // Aguarda o debounce de 300ms + resposta do mock
    await page.waitForResponse(r => r.url().includes('/api/municipios'))

    await expect(page.getByText(MUNICIPIO_A.nome)).toBeVisible()
  })

  test('deve navegar para /perfil/:id ao selecionar município', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))

    await page.getByText(MUNICIPIO_A.nome).click()
    await expect(page).toHaveURL(new RegExp(`/perfil/${MUNICIPIO_A.codigo_ibge}`))
  })

  test('deve limpar busca ao clicar no botão X', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /Buscar município/i })
    await input.fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))

    await page.getByRole('button', { name: /Limpar busca/i }).click()
    await expect(input).toHaveValue('')
  })
})

test.describe('Exibição do perfil municipal', () => {
  test.beforeEach(async ({ page }) => {
    await registrarMocks(page)
    // Aguarda a resposta mockada do perfil antes de prosseguir
    const respostaPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.goto(`/perfil/${MUNICIPIO_A.codigo_ibge}`)
    await respostaPromise
  })

  test('deve exibir nome do município no cabeçalho', async ({ page }) => {
    await expect(page.getByRole('heading', { name: PERFIL_A.municipio.nome })).toBeVisible()
  })

  test('deve exibir código IBGE do município', async ({ page }) => {
    await expect(page.getByText(`IBGE ${MUNICIPIO_A.codigo_ibge}`)).toBeVisible()
  })

  test('deve exibir tabs de pilar com contagem de indicadores', async ({ page }) => {
    const tabMercado = page.getByRole('tab', { name: /Potencial de Mercado/i })
    const tabSocial = page.getByRole('tab', { name: /Potencial Social/i })

    await expect(tabMercado).toBeVisible()
    await expect(tabSocial).toBeVisible()

    // Tab mercado deve estar selecionada por padrão
    await expect(tabMercado).toHaveAttribute('aria-selected', 'true')
  })

  test('deve alternar para tab Social ao clicar', async ({ page }) => {
    await page.getByRole('tab', { name: /Potencial Social/i }).click()
    await expect(page.getByRole('tab', { name: /Potencial Social/i })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: /Potencial de Mercado/i })).toHaveAttribute('aria-selected', 'false')
  })

  test('deve exibir indicadores de mercado com nome e fonte', async ({ page }) => {
    await expect(page.getByText('Densidade Populacional')).toBeVisible()
    await expect(page.getByText('PIB per capita')).toBeVisible()
    await expect(page.getByText('IBGE').first()).toBeVisible()
  })

  test('deve exibir indicador indisponível com badge correto', async ({ page }) => {
    await expect(page.getByText('Indisponível').first()).toBeVisible()
  })

  test('deve exibir botão "Investigar com IA"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Investigar com IA/i })).toBeVisible()
  })

  test('deve navegar para /investigar ao clicar em "Investigar com IA"', async ({ page }) => {
    await page.getByRole('button', { name: /Investigar com IA/i }).click()
    await expect(page).toHaveURL(/\/investigar\?municipio=/)
  })

  test('deve exibir nota de integridade no perfil', async ({ page }) => {
    await expect(page.getByText('Integridade dos dados:')).toBeVisible()
  })
})
