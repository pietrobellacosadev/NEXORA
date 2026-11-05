/**
 * E2E — 03 Comparação entre municípios
 *
 * Cobre:
 *   6. Comparação entre municípios
 */

import { test, expect } from '@playwright/test'
import { registrarMocks } from './fixtures/mock-handlers'
import { MUNICIPIO_A, MUNICIPIO_B } from './fixtures/dados-teste'

test.describe('Comparação municipal', () => {
  test.beforeEach(async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/comparar')
  })

  test('deve exibir estado vazio ao acessar /comparar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nenhum município selecionado' })).toBeVisible()
    await expect(page.getByText('Busque municípios acima')).toBeVisible()
  })

  test('deve exibir hint de quantos municípios podem ser adicionados', async ({ page }) => {
    await expect(page.getByText(/Adicione até 4 municípios/i)).toBeVisible()
  })

  test('deve exibir campo de busca para comparação', async ({ page }) => {
    const input = page.getByRole('searchbox', { name: /Buscar município para comparar/i })
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()
  })

  test('deve exibir sugestões ao buscar município', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))

    await expect(page.getByText(MUNICIPIO_A.nome)).toBeVisible()
  })

  test('deve adicionar município como chip ao selecioná-lo', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))

    // Inicia espera pelo perfil ANTES do click para não perder o evento
    const perfilPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfilPromise

    // Chip deve aparecer
    await expect(page.getByText(MUNICIPIO_A.nome).first()).toBeVisible()
    // Tabela deve aparecer
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('deve exibir tabela com indicadores após adicionar município', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfilPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfilPromise

    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText('Densidade Populacional')).toBeVisible()
  })

  test('deve remover município ao clicar no botão de remoção do chip', async ({ page }) => {
    // Adiciona
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfilPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfilPromise

    // Remove
    await page.getByRole('button', { name: new RegExp(`Remover ${MUNICIPIO_A.nome}`, 'i') }).click()

    // Estado vazio deve reaparecer
    await expect(page.getByRole('heading', { name: 'Nenhum município selecionado' })).toBeVisible()
  })

  test('deve exibir tabs Mercado e Social na tabela comparativa', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfilPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfilPromise

    await expect(page.getByRole('tab', { name: /Potencial de Mercado/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Potencial Social/i })).toBeVisible()
  })

  test('deve atualizar tabela ao trocar para tab Social', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfilPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfilPromise

    await page.getByRole('tab', { name: /Potencial Social/i }).click()
    await expect(page.getByText('IDEB Anos Iniciais')).toBeVisible()
  })

  test('deve adicionar dois municípios e exibir ambos como colunas', async ({ page }) => {
    // Adiciona primeiro
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfil1Promise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfil1Promise

    // Adiciona segundo
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Adolfo')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfil2Promise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_B.nome).click()
    await perfil2Promise

    // Ambos devem aparecer como colunas no cabeçalho da tabela
    const cabecalhos = page.getByRole('columnheader')
    await expect(cabecalhos).toHaveCount(3) // indicador + 2 municípios
  })

  test('deve exibir nota de integridade com aviso sobre estimativas', async ({ page }) => {
    await page.getByRole('searchbox', { name: /Buscar município para comparar/i }).fill('Ada')
    await page.waitForResponse(r => r.url().includes('/api/municipios'))
    const perfilPromise = page.waitForResponse(
      r => r.url().includes('/api/municipios/') && r.url().includes('/perfil'),
      { timeout: 10_000 }
    )
    await page.getByText(MUNICIPIO_A.nome).click()
    await perfilPromise

    await expect(page.getByText(/indicadores classificados como/i)).toBeVisible()
  })
})
