// Fluxo (40, movimento reduzido — padrão da suíte): números, barras, hover e esqueleto instantâneos (fluidez F3).
// Com "reduzir movimento" o valor é imediato desde o 1º quadro, as barras já nascem no tamanho final e o esqueleto não pulsa.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, test } from './base';

/** Antes da navegação: guarda, por quadro, o texto do número, o aria-label e a escala/opacidade do alvo. */
async function amostrar(page: Page, testids: string[]): Promise<void> {
  await page.addInitScript((lista) => {
    const w = window as unknown as { __v: Record<string, { texto: string; rotulo: string; escalaX: number; escalaY: number; opacidade: number }[]> };
    w.__v = {};
    const inicio = performance.now();
    const quadro = () => {
      for (const id of lista) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el || el.getClientRects().length === 0) continue;
        const cs = getComputedStyle(el);
        const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
        (w.__v[id] ??= []).push({ texto: el.firstElementChild?.textContent ?? '', rotulo: el.getAttribute('aria-label') ?? '', escalaX: m.a, escalaY: m.d, opacidade: parseFloat(cs.opacity) });
      }
      if (performance.now() - inicio < 4000) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, testids);
}

const lerV = (page: Page) => page.evaluate(() => (window as unknown as { __v: Record<string, { texto: string; rotulo: string; escalaX: number; escalaY: number; opacidade: number }[]> }).__v);

test('Dashboard: o número aparece já no valor final (sem contagem) e o rótulo é o mesmo desde o 1º quadro', async ({ page, api }) => {
  api.atrasar(/^\/api\/employees\?/, 400, 'GET');
  await entrarComoRh(page);
  await amostrar(page, ['numero-equipe-hoje']);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(900);
  const serie = (await lerV(page))['numero-equipe-hoje'];
  expect(serie.length).toBeGreaterThan(3);
  expect([...new Set(serie.map((q) => q.texto))], 'houve valor intermediário com movimento reduzido').toEqual(['5']);
  expect(new Set(serie.map((q) => q.rotulo))).toEqual(new Set(['5']));
});

test('NPS: número, faixa e barras já nascem finais (escala 1 em todos os quadros) com movimento reduzido', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [{ question: 'De 0 a 10, quanto recomendaria?', type: 'nps', required: true }]);
  const pergunta = s.questions?.[0].id ?? 0;
  for (const nota of [10, 10, 9, 3]) api.semearResposta(s.id, [{ question_id: pergunta, score: nota }]);
  api.atrasar(/^\/api\/surveys\/\d+\/results/, 300, 'GET');
  await entrarComoRh(page);
  await amostrar(page, ['numero-nps', 'faixa-nps', 'barra-nps-10', 'barra-nps-3']);
  await page.goto(`/nps/${s.id}`);
  await expect(page.getByTestId('numero-nps')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(900);
  const v = await lerV(page);
  expect([...new Set(v['numero-nps'].map((q) => q.texto))]).toEqual(['+50']);
  expect(new Set(v['faixa-nps'].map((q) => q.escalaX))).toEqual(new Set([1]));
  expect(new Set(v['barra-nps-10'].map((q) => q.escalaY))).toEqual(new Set([1]));
  expect(new Set(v['barra-nps-3'].map((q) => q.escalaY))).toEqual(new Set([1]));
});

test('o esqueleto não pulsa com movimento reduzido (opacidade parada)', async ({ page, api }) => {
  api.atrasar(/^\/api\/employees\?/, 4000, 'GET');
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  const barra = page.getByRole('progressbar', { name: 'Carregando equipe' });
  await expect(barra).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(300);
  const opacidades = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="esq-linha"]') as HTMLElement;
    const lista: number[] = [];
    for (let i = 0; i < 20; i++) {
      lista.push(Math.round(parseFloat(getComputedStyle(el.querySelector('div') as HTMLElement).opacity) * 100) / 100);
      await new Promise((r) => setTimeout(r, 60));
    }
    return lista;
  });
  expect(new Set(opacidades).size, `opacidades: ${opacidades.join(',')}`).toBe(1);
});
