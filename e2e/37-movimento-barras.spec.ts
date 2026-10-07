// Fluxo (37, projeto "movimento"): barras e medidor crescem do zero ao valor (fluidez F3), escalonadas, só com transform
// (o tamanho de layout já nasce o final) e terminam EXATAMENTE na largura/altura certa. Revisita: já nasce pronta.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, itemDaSidebar, test } from './base';

/** Escala X/Y atual (m11 / m22 do transform acumulado do próprio elemento) por quadro, com o instante em que saiu de ~0. */
async function amostrarEscalas(page: Page, ids: string[], eixo: 'x' | 'y'): Promise<void> {
  await page.addInitScript(({ lista, eixoMedido }) => {
    const w = window as unknown as { __escalas: Record<string, { t: number; e: number }[]> };
    w.__escalas = {};
    const inicio = performance.now();
    const quadro = () => {
      for (const id of lista) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el || el.getClientRects().length === 0) continue;
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
        (w.__escalas[id] ??= []).push({ t: performance.now() - inicio, e: eixoMedido === 'x' ? m.a : m.d });
      }
      if (performance.now() - inicio < 6000) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, { lista: ids, eixoMedido: eixo });
}

test('NPS: as barras de 0 a 10 crescem escalonadas (≤ 60 ms entre elas) e terminam na altura certa', async ({ page, api }, info) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [{ question: 'De 0 a 10, quanto recomendaria?', type: 'nps', required: true }]);
  const pergunta = s.questions?.[0].id ?? 0;
  // Notas 10 ×4, 9 ×2, 8 ×1, 3 ×1: a barra mais alta é a do 10 (4 respostas) = 72 px; as outras são proporcionais.
  for (const nota of [10, 10, 10, 10, 9, 9, 8, 3]) api.semearResposta(s.id, [{ question_id: pergunta, score: nota }]);
  api.atrasar(/^\/api\/surveys\/\d+\/results/, 300, 'GET');
  await entrarComoRh(page);
  const ids = Array.from({ length: 11 }, (_, n) => `barra-nps-${n}`);
  await amostrarEscalas(page, [...ids, 'faixa-nps'], 'y');
  await page.goto(`/nps/${s.id}`);
  await expect(page.getByTestId('barra-nps-10')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  const escalas = await page.evaluate(() => (window as unknown as { __escalas: Record<string, { t: number; e: number }[]> }).__escalas);

  // Cada barra: começa perto de 0, passa por valores intermediários e termina em 1 exato.
  const inicios: number[] = [];
  for (const id of ids) {
    const serie = escalas[id] ?? [];
    expect(serie.length, `${id} sem amostras`).toBeGreaterThan(3);
    expect(serie[0].e, `${id} deveria nascer perto de 0`).toBeLessThan(0.2);
    expect(serie.some((p) => p.e > 0.1 && p.e < 0.95), `${id} sem valores intermediários`).toBe(true);
    expect(serie[serie.length - 1].e).toBeCloseTo(1, 5);
    inicios.push(serie.find((p) => p.e > 0.05)?.t ?? -1);
  }
  // Escalonamento: a barra N nunca começa ANTES da anterior, e o intervalo médio é ≤ 60 ms (+ folga de quadros).
  inicios.forEach((t, i) => { if (i > 0) expect(t, `a barra ${i} começou antes da ${i - 1}`).toBeGreaterThanOrEqual(inicios[i - 1] - 20); });
  const intervaloMedio = (inicios[7] - inicios[0]) / 7;
  info.annotations.push({ type: 'medicao', description: `Barras do NPS: intervalo médio de início ${Math.round(intervaloMedio)} ms (máx. configurado 50), fim em ${Math.round(Math.max(...ids.map((id) => escalas[id][escalas[id].length - 1].t)))} ms` });
  expect(intervaloMedio).toBeLessThanOrEqual(80);

  // Altura final no layout: proporcional ao número de respostas (a maior = 72 px, mínimo de 3 px).
  const alturas = await page.evaluate((lista) => lista.map((id) => (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).offsetHeight), ids);
  expect(alturas[10]).toBe(72);
  expect(alturas[9]).toBe(36);
  expect(alturas[8]).toBe(18);
  expect(alturas[3]).toBe(18);
  expect(alturas[0]).toBe(3);
});

test('NPS: a faixa promotores/neutros/detratores se preenche da esquerda para a direita e termina inteira', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [{ question: 'De 0 a 10, quanto recomendaria?', type: 'nps', required: true }]);
  const pergunta = s.questions?.[0].id ?? 0;
  for (const nota of [10, 9, 8, 3]) api.semearResposta(s.id, [{ question_id: pergunta, score: nota }]);
  api.atrasar(/^\/api\/surveys\/\d+\/results/, 300, 'GET');
  await entrarComoRh(page);
  await amostrarEscalas(page, ['faixa-nps'], 'x');
  await page.goto(`/nps/${s.id}`);
  await expect(page.getByTestId('faixa-nps')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  const serie = (await page.evaluate(() => (window as unknown as { __escalas: Record<string, { t: number; e: number }[]> }).__escalas))['faixa-nps'];
  expect(serie[0].e).toBeLessThan(0.2);
  expect(serie.some((p) => p.e > 0.1 && p.e < 0.95)).toBe(true);
  expect(serie[serie.length - 1].e).toBeCloseTo(1, 5);
  // O tamanho de layout nunca muda (só o transform): a faixa ocupa a largura toda do começo ao fim.
  const larg = await page.getByTestId('faixa-nps').evaluate((el) => (el as HTMLElement).offsetWidth);
  expect(larg).toBeGreaterThan(200);
});

test('Dashboard: a barra de disponibilidade termina na largura exata (o % do rótulo = % da largura) e a revisita já nasce pronta', async ({ page, api }) => {
  api.atrasar(/^\/api\/employees\?/, 400, 'GET');
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByText('Equipe hoje')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  const barra = page.getByRole('progressbar', { name: /da equipe disponível hoje/ });
  const medida = await barra.evaluate((el) => {
    const preenchimento = el.firstElementChild as HTMLElement;
    return { agora: Number(/^(\d+)%/.exec(el.getAttribute('aria-label') ?? '')?.[1] ?? Number.NaN), pct: (preenchimento.getBoundingClientRect().width / el.getBoundingClientRect().width) * 100 };
  });
  expect(medida.pct).toBeCloseTo(medida.agora, 0);

  // Revisita (tela de aba continua montada; o preenchimento não recomeça do zero).
  await itemDaSidebar(page, 'Equipe').click();
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
  await itemDaSidebar(page, 'Dashboard').click();
  const logo = await barra.evaluate((el) => (el.firstElementChild as HTMLElement).getBoundingClientRect().width / el.getBoundingClientRect().width * 100);
  expect(logo).toBeCloseTo(medida.agora, 0);
});
