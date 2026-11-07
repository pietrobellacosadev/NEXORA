import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração Playwright — NEXORA
 *
 * Testes E2E rodam contra o frontend Vite (porta 5173) com mocks de rede
 * para as chamadas ao backend FastAPI.
 *
 * Para rodar com o backend real, use: NEXORA_E2E_REAL=1 npx playwright test
 */
export default defineConfig({
  testDir: './src/e2e',
  testMatch: '**/*.spec.ts',

  /* Timeout por teste */
  timeout: 30_000,

  /* Timeout por assertion */
  expect: { timeout: 8_000 },

  /* Executa testes em paralelo por arquivo, seqüencial dentro de cada arquivo */
  fullyParallel: false,
  workers: 1,

  /* Apenas em CI: falha toda a suite ao primeiro retried failure */
  forbidOnly: !!process.env.CI,

  /* Sem retry por padrão; 1 retry em CI */
  retries: process.env.CI ? 1 : 0,

  /* Relatório */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    /* URL base do frontend Vite */
    baseURL: 'http://localhost:5173',

    /* Captura screenshots e traces somente em falhas */
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',

    /* Viewport padrão */
    viewport: { width: 1280, height: 800 },

    /* Locale pt-BR para toLocaleString */
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Sobe o Vite antes de rodar os testes */
  webServer: {
    command: '"C:/Program Files/nodejs/node.exe" node_modules/vite/bin/vite.js --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
