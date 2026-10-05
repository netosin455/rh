// ============================================================
// playwright.config.ts — SuperRH (testes E2E)
// O teste roda o app web COMPILADO contra uma API 100% simulada (e2e/apiSimulada.ts).
// Nada aqui toca produção ou banco: qualquer requisição fora de 127.0.0.1:4173 derruba o teste.
// ============================================================

import { defineConfig } from '@playwright/test';

const emCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Cada teste cria o próprio estado da API: dá para rodar em paralelo sem um atrapalhar o outro.
  fullyParallel: true,
  workers: emCI ? 2 : undefined,
  forbidOnly: emCI,
  retries: emCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: emCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1280, height: 800 },
    // Local: Chrome instalado na máquina. CI: Chromium baixado por `npm run e2e:install`.
    ...(emCI ? {} : { channel: 'chrome' }),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    // Gera o build (a menos que E2E_REUSE_BUILD=1) e serve em 127.0.0.1:4173.
    command: 'node e2e/servidor.mjs',
    url: 'http://127.0.0.1:4173',
    // Nunca reaproveita um servidor já aberto: ele poderia ser outro app.
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
