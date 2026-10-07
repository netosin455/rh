// Fluxo (36, projeto "movimento"): contagem animada dos números (fluidez F3). O valor final é exato, o leitor de tela
// recebe o valor FINAL desde o 1º quadro, e a contagem só acontece quando o número vem de um esqueleto (nunca em revisita).

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, itemDaSidebar, test } from './base';

interface Quadro { t: number; texto: string; rotulo: string; escondido: string | null }

/** Instala, ANTES da navegação, um amostrador por quadro do número de `data-testid=<id>`: texto, aria-label e aria-hidden. */
async function amostrarNumero(page: Page, id: string): Promise<void> {
  await page.addInitScript((testid) => {
    const w = window as unknown as { __quadros: Quadro[] };
    w.__quadros = [];
    const inicio = performance.now();
    const quadro = () => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (el && el.getClientRects().length > 0) {
        const texto = el.firstElementChild;
        w.__quadros.push({ t: performance.now() - inicio, texto: texto?.textContent ?? '', rotulo: el.getAttribute('aria-label') ?? '', escondido: texto?.getAttribute('aria-hidden') ?? null });
      }
      if (performance.now() - inicio < 6000) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, id);
}

async function lerQuadros(page: Page): Promise<Quadro[]> {
  return page.evaluate(() => (window as unknown as { __quadros: Quadro[] }).__quadros);
}

test('Dashboard: o número conta de 0 ao valor exato ao sair do esqueleto, e o leitor de tela já recebe o valor final', async ({ page, api }, info) => {
  api.atrasar(/^\/api\/employees\?/, 500, 'GET');
  await entrarComoRh(page);
  await amostrarNumero(page, 'numero-equipe-hoje');
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200); // a contagem dura ~500 ms
  const quadros = await lerQuadros(page);

  const textos = quadros.map((q) => q.texto);
  const distintos = [...new Set(textos)];
  info.annotations.push({ type: 'medicao', description: `Contagem do Dashboard: ${distintos.join(' → ')} em ${Math.round(quadros[quadros.length - 1].t - quadros[0].t)} ms, ${quadros.length} quadros` });
  expect(quadros.length).toBeGreaterThan(5);
  expect(textos[0], 'a contagem parte de 0').toBe('0');
  expect(textos[textos.length - 1], 'o valor final é exato').toBe('5');
  expect(distintos.length, `valores vistos: ${distintos.join(',')}`).toBeGreaterThan(2); // houve valores intermediários
  const numeros = textos.map(Number);
  expect(numeros.every((n, i) => i === 0 || n >= numeros[i - 1]), 'a contagem nunca volta atrás').toBe(true);
  // Leitor de tela: o rótulo é o valor final em TODOS os quadros e o texto que conta fica escondido dele.
  expect(new Set(quadros.map((q) => q.rotulo))).toEqual(new Set(['5']));
  expect(new Set(quadros.map((q) => q.escondido))).toEqual(new Set(['true']));
});

test('Dashboard: voltar a uma tela já vista nunca recomeça a contagem (revisita com cache)', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(900);
  await itemDaSidebar(page, 'Equipe').click();
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
  await amostrarNumeroAgora(page, 'numero-equipe-hoje');
  await itemDaSidebar(page, 'Dashboard').click();
  await page.waitForTimeout(900);
  const textos = (await lerQuadros(page)).map((q) => q.texto);
  expect(textos.length).toBeGreaterThan(5);
  expect([...new Set(textos)], 'a revisita mostrou valores intermediários').toEqual(['5']);
});

async function amostrarNumeroAgora(page: Page, id: string): Promise<void> {
  await page.evaluate((testid) => {
    const w = window as unknown as { __quadros: Quadro[] };
    w.__quadros = [];
    const inicio = performance.now();
    const quadro = () => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (el && el.getClientRects().length > 0) {
        const texto = el.firstElementChild;
        w.__quadros.push({ t: performance.now() - inicio, texto: texto?.textContent ?? '', rotulo: el.getAttribute('aria-label') ?? '', escondido: texto?.getAttribute('aria-hidden') ?? null });
      }
      if (performance.now() - inicio < 1500) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, id);
}

test('NPS: o número grande conta com sinal (+N), termina exato e o rótulo "NPS +N" está lá desde o 1º quadro', async ({ page, api }, info) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [{ question: 'De 0 a 10, quanto recomendaria?', type: 'nps', required: true }]);
  const pergunta = s.questions?.[0].id ?? 0;
  // 8 promotores (10), 1 neutro (8), 1 detrator (3): NPS = (8 − 1) / 10 = +70
  for (let i = 0; i < 8; i++) api.semearResposta(s.id, [{ question_id: pergunta, score: 10 }]);
  api.semearResposta(s.id, [{ question_id: pergunta, score: 8 }]);
  api.semearResposta(s.id, [{ question_id: pergunta, score: 3 }]);
  api.atrasar(/^\/api\/surveys\/\d+\/results/, 400, 'GET');
  await entrarComoRh(page);
  await amostrarNumero(page, 'numero-nps');
  await page.goto(`/nps/${s.id}`);
  await expect(page.getByTestId('numero-nps')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  const quadros = await lerQuadros(page);
  const distintos = [...new Set(quadros.map((q) => q.texto))];
  info.annotations.push({ type: 'medicao', description: `Contagem do NPS: ${distintos.join(' → ')}` });
  expect(quadros[0].texto).toBe('0');
  expect(quadros[quadros.length - 1].texto).toBe('+70');
  expect(distintos.length).toBeGreaterThan(2);
  expect(new Set(quadros.map((q) => q.rotulo))).toEqual(new Set(['NPS +70']));
});
