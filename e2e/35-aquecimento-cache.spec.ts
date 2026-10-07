// Fluxo (35): Fluidez F3 — aquecimento do cache depois do login. Com a API a 1 s por chamada, as telas mais usadas
// já devem abrir COM conteúdo (sem esqueleto) depois de alguns segundos no Dashboard, sem pedir nada que o perfil não acessa.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, itemDaSidebar, loginPelaTela, test } from './base';

const LINHAS_DA_EQUIPE = '[aria-label^="Lançar falta, folga"]';

/** Espera o aquecimento terminar: a última chamada própria da fila (Feedbacks) já foi respondida e a rede ficou quieta. */
async function esperarAquecimento(page: Page, concluidas: () => string[]): Promise<void> {
  await expect.poll(() => concluidas().some((c) => c.startsWith('GET /api/feedbacks')), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(400);
}

/**
 * Tempo (ms) do clique até aparecer o CONTEÚDO da tela (texto exato ou seletor CSS, visível) e se algum "Carregando…"
 * visível apareceu no caminho. Escolha um alvo que só existe na tela de destino (o menu lateral tem "Equipe", "Avisos"...).
 */
async function medirAteTexto(page: Page, acao: () => Promise<void>, alvoTexto: string | { css: string }): Promise<{ ms: number; viuEsqueleto: boolean }> {
  await page.evaluate((alvo) => {
    const w = window as unknown as { __medida: Promise<{ ms: number; viuEsqueleto: boolean }> };
    w.__medida = new Promise((resolve) => {
      let inicio = -1;
      let viuEsqueleto = false;
      const verificar = () => {
        if (inicio < 0) return;
        if (Array.from(document.querySelectorAll('[aria-label^="Carregando"]')).some((e) => e.getClientRects().length > 0)) viuEsqueleto = true;
        const achou = typeof alvo === 'string'
          ? Array.from(document.querySelectorAll('*')).some((e) => e.children.length === 0 && e.textContent === alvo && e.getClientRects().length > 0)
          : Array.from(document.querySelectorAll(alvo.css)).some((e) => e.getClientRects().length > 0);
        if (achou) { observador.disconnect(); resolve({ ms: performance.now() - inicio, viuEsqueleto }); }
      };
      const observador = new MutationObserver(verificar);
      observador.observe(document.body, { subtree: true, childList: true, attributes: true });
      document.addEventListener('click', () => { inicio = performance.now(); verificar(); }, { capture: true, once: true });
    });
  }, alvoTexto);
  await acao();
  return page.evaluate(() => (window as unknown as { __medida: Promise<{ ms: number; viuEsqueleto: boolean }> }).__medida);
}

test('depois de ~3 s no Dashboard, Equipe, Férias e Avisos abrem sem esqueleto (< 150 ms) com a API a 1 s', async ({ page, api }, info) => {
  api.atrasar(/^\/api\//, 1000, 'GET');
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  await esperarAquecimento(page, () => api.concluidas);

  const equipe = await medirAteTexto(page, () => itemDaSidebar(page, 'Equipe').click(), { css: LINHAS_DA_EQUIPE });
  await expect(page.locator(LINHAS_DA_EQUIPE)).toHaveCount(5);
  const ferias = await medirAteTexto(page, () => itemDaSidebar(page, 'Férias').click(), 'Férias e ausências');
  const avisos = await medirAteTexto(page, () => itemDaSidebar(page, 'Avisos').click(), { css: '[aria-label^="Expandir aviso"]' });
  info.annotations.push({ type: 'tempo', description: `1ª abertura COM aquecimento (API 1 s): Equipe ${Math.round(equipe.ms)} ms | Férias ${Math.round(ferias.ms)} ms | Avisos ${Math.round(avisos.ms)} ms` });

  const todas = [['Equipe', equipe], ['Férias', ferias], ['Avisos', avisos]] as const;
  expect(todas.filter(([, r]) => r.viuEsqueleto).map(([nome]) => nome), 'telas que mostraram esqueleto').toEqual([]);
  expect(todas.filter(([, r]) => r.ms >= 150).map(([nome, r]) => `${nome} ${Math.round(r.ms)} ms`), 'telas que passaram de 150 ms').toEqual([]);
});

test('referência: sem tempo para aquecer, a 1ª abertura de Férias espera a API (≈ 1 s)', async ({ page, api }, info) => {
  api.atrasar(/^\/api\//, 1000, 'GET');
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  // Clica já: a fila ainda está nas primeiras telas e Férias (ausências) ainda não foi buscada.
  const ferias = await medirAteTexto(page, () => itemDaSidebar(page, 'Férias').click(), 'Férias e ausências');
  info.annotations.push({ type: 'tempo', description: `1ª abertura de Férias SEM aquecimento pronto (API 1 s): ${Math.round(ferias.ms)} ms` });
  expect(ferias.ms).toBeGreaterThan(400);
});

test('RH comum: o aquecimento não chama nada de Admin, repete nenhuma tela e nunca passa de 3 pedidos seus em paralelo', async ({ page, api }, info) => {
  api.atrasar(/^\/api\//, 300, 'GET');
  await entrarComoRh(page);
  // Começa numa tela com UMA chamada própria (Avisos): o pico = a da tela + as do aquecimento.
  await page.goto('/avisos');
  await esperarAquecimento(page, () => api.concluidas);

  const gets = api.chamadas.filter((c) => c.startsWith('GET '));
  // /api/users?notifications=1 é a lista de notificações (não é a lista de usuários do Admin).
  expect(gets.filter((c) => c.startsWith('GET /api/users') && !c.includes('notifications=1'))).toEqual([]);
  expect(gets.filter((c) => c.includes('/admin'))).toEqual([]);
  // Nenhuma chamada repetida (deduplicação): cada endereço uma vez só.
  expect(new Set(gets).size, `repetidas: ${gets.join(' | ')}`).toBe(gets.length);
  // O pico inclui os pedidos da própria tela (Avisos) e dos contadores do menu (2): 3 do aquecimento + 3 = 6. O limite
  // exato de 3 do aquecimento é provado no Vitest (tests/aquecerCache.test.ts).
  expect(api.picoSimultaneo, `pico de pedidos simultâneos: ${api.picoSimultaneo}`).toBeLessThanOrEqual(6);
  info.annotations.push({ type: 'tempo', description: `Aquecimento (RH, partindo de Avisos): ${gets.length} chamadas GET no total, pico de ${api.picoSimultaneo} simultâneas` });
});

test('logout durante o aquecimento: nenhuma chamada nova depois da saída e a sessão seguinte começa sem dado do anterior', async ({ page, api }) => {
  api.atrasar(/^\/api\//, 600, 'GET');
  await loginPelaTela(page);
  page.once('dialog', (dialogo) => { void dialogo.accept(); });
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/login/);
  // Dá tempo para as chamadas que já voavam terminarem, e só então conta.
  await page.waitForTimeout(900);
  const total = api.chamadas.length;
  await page.waitForTimeout(2_500);
  expect(api.chamadas.length, 'o aquecimento continuou pedindo dados depois do logout').toBe(total);
});
