// ============================================================
// playwright.config.ts — SuperRH (testes E2E)
// O teste roda o app web COMPILADO contra uma API 100% simulada (e2e/apiSimulada.ts).
// Nada aqui toca produção ou banco: qualquer requisição fora de 127.0.0.1:4173 derruba o teste.
// ============================================================

import { defineConfig } from '@playwright/test';

const emCI = Boolean(process.env.CI);
const origem = `http://127.0.0.1:${process.env.E2E_PORTA ?? 4173}`;

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
    baseURL: origem,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1280, height: 800 },
    // Toda a suíte roda com "reduzir movimento": nada anima (sem flakiness). Só o projeto "movimento" liga as animações.
    reducedMotion: 'reduce',
    // Local: Chrome instalado na máquina. CI: Chromium baixado por `npm run e2e:install`.
    ...(emCI ? {} : { channel: 'chrome' }),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    // Telas de computador (sidebar fixa, 1280x800): tudo, menos os specs de celular.
    { name: 'desktop', testIgnore: /-(celular|movimento).*\.spec\.ts/ },
    // Animações de verdade (fase F2): só os specs NN-movimento-* (entrada, saída, CLS). Desktop, mesmo servidor.
    { name: 'movimento', testMatch: /-movimento.*\.spec\.ts/, use: { reducedMotion: 'no-preference' } },
    // Celular (390x844, toque): só os specs NN-celular-*. Mesmo servidor e mesma API simulada.
    {
      name: 'celular',
      testMatch: /-celular.*\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    // Gera o build (a menos que E2E_REUSE_BUILD=1) e serve em 127.0.0.1:4173.
    command: 'node e2e/servidor.mjs',
    url: origem,
    // Nunca reaproveita um servidor já aberto: ele poderia ser outro app.
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
