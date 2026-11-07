/**
 * E2E — 01 Carregamento inicial e navegação
 *
 * Cobre:
 *   1. Carregamento inicial da aplicação (dashboard)
 *   2. Navegação entre todas as páginas via menu lateral
 */

import { test, expect } from '@playwright/test'
import { registrarMocks } from './fixtures/mock-handlers'

test.describe('Carregamento inicial', () => {
  test('deve carregar o dashboard com título e estatísticas', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    // Título principal
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Conectividade orientada')

    // Slogan / accent
    await expect(page.getByText('dados reais')).toBeVisible()

    // Stats (verificamos ao menos dois — usamos exact para evitar strict mode violation)
    await expect(page.getByText('645', { exact: true })).toBeVisible()
    await expect(page.getByText('Municípios analisados')).toBeVisible()
    await expect(page.getByText('3 Agentes IA')).toBeVisible()
  })

  test('deve exibir os cards de funcionalidades', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Mapa Territorial' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Perfil Municipal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Comparação' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Investigação por IA' })).toBeVisible()
  })

  test('deve exibir nota de integridade no dashboard', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    await expect(page.getByRole('note')).toContainText('Integridade dos dados')
  })
})

test.describe('Navegação entre páginas', () => {
  test('deve navegar para o Mapa via link do hero', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    await page.getByRole('link', { name: /Explorar mapa/i }).click()
    await expect(page).toHaveURL(/\/mapa/)
  })

  test('deve navegar para Investigar via link do hero', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    await page.getByRole('link', { name: /Investigar município/i }).click()
    await expect(page).toHaveURL(/\/investigar/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Investigação por IA')
  })

  test('deve navegar para Perfil via card de funcionalidades', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    await page.getByRole('link', { name: /Perfil Municipal/i }).click()
    await expect(page).toHaveURL(/\/perfil/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Perfil Municipal')
  })

  test('deve navegar para Comparação via card de funcionalidades', async ({ page }) => {
    await registrarMocks(page)
    await page.goto('/')

    // Navega via heading do card (evita colisão com link "Comparação" do menu lateral)
    await page.getByRole('heading', { name: 'Comparação', level: 3 }).click()
    await expect(page).toHaveURL(/\/comparar/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Comparação Municipal')
  })

  test('deve navegar pelas rotas diretas sem erro', async ({ page }) => {
    await registrarMocks(page)

    for (const rota of ['/', '/mapa', '/perfil', '/comparar', '/investigar']) {
      await page.goto(rota)
      // Não deve mostrar tela de erro (sem texto "Cannot GET")
      const body = await page.textContent('body')
      expect(body).not.toContain('Cannot GET')
    }
  })
})
