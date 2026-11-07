/**
 * Mock handlers para interceptar chamadas à API do backend FastAPI.
 *
 * Os testes E2E usam route.fulfill() do Playwright para interceptar
 * as requisições axios ao /api/** e retornar dados sintéticos de teste.
 * Isso garante que nenhuma chamada real chegue ao backend / GroqCloud.
 */

import type { Page, Route } from '@playwright/test'
import {
  MUNICIPIO_LISTA,
  MUNICIPIO_A,
  PERFIL_A,
  PERFIL_B,
  RESULTADO_INVESTIGACAO,
} from './dados-teste'

type MockOptions = {
  /** Simula falha da API (status 503) para testes de tratamento de erro */
  apiOffline?: boolean
}

/**
 * Registra todos os interceptadores de rota na página via função de predicado.
 * Usando funções em vez de glob patterns para garantir interceptação correta.
 * Deve ser chamado ANTES de page.goto().
 */
export async function registrarMocks(page: Page, opts: MockOptions = {}) {
  // A função de rota é registrada como handler genérico que despacha por URL
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route: Route) => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      // ── POST /api/investigar ─────────────────────────────────────────────
      if (path === '/api/investigar' && method === 'POST') {
        if (opts.apiOffline) {
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Serviço temporariamente indisponível.' }),
          })
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RESULTADO_INVESTIGACAO),
        })
      }

      // ── GET /api/municipios/:id/perfil ──────────────────────────────────
      if (method === 'GET' && /^\/api\/municipios\/\d+\/perfil$/.test(path)) {
        if (opts.apiOffline) {
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Serviço indisponível.' }),
          })
        }
        const codigo = path.match(/\/municipios\/(\d+)\/perfil/)?.[1]
        const perfil = codigo === PERFIL_B.municipio.codigo_ibge ? PERFIL_B : PERFIL_A
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(perfil),
        })
      }

      // ── GET /api/municipios/:id ─────────────────────────────────────────
      if (method === 'GET' && /^\/api\/municipios\/\d+$/.test(path)) {
        if (opts.apiOffline) {
          return route.fulfill({ status: 503, body: 'Service Unavailable' })
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MUNICIPIO_A),
        })
      }

      // ── GET /api/municipios (listagem / busca) ──────────────────────────
      if (method === 'GET' && path === '/api/municipios') {
        if (opts.apiOffline) {
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Serviço indisponível.' }),
          })
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MUNICIPIO_LISTA),
        })
      }

      // Deixa outras rotas passarem (ex: GeoJSON estático)
      return route.continue()
    }
  )
}
