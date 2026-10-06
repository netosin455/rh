// Fluxo (32, projeto "movimento"): remover item (otimista da F1) sai com fade, a lista fecha o vazio SEM pular,
// e no rollback (API falhando) o item volta com a mesma suavidade.

import { controlarConfirmacoes, entrarComoRh, expect, FUNCOES_DE_MOVIMENTO, test } from './base';
import type { Page } from '@playwright/test';

type Quadro = { t: number; alvoPresente: boolean; alvoOp: number; irmaoY: number };

/** Amostra a cada quadro: se o item `alvo` existe e com que opacidade, e a posição vertical do item `irmao` (abaixo dele). */
async function amostrar(page: Page, alvo: string, irmao: string, duracaoMs: number): Promise<void> {
  await page.evaluate(({ funcoes, alvo: a, irmao: i, duracao }) => {
    // eslint-disable-next-line no-new-func
    new Function(funcoes)();
    const w = window as unknown as { __opacidadeEfetiva: (e: Element) => number; __quadros: Quadro[] };
    w.__quadros = [];
    const achar = (texto: string) => Array.from(document.querySelectorAll('div')).find((d) => d.textContent === texto && d.getClientRects().length > 0);
    const t0 = performance.now();
    const quadro = () => {
      const elAlvo = achar(a);
      const elIrmao = achar(i);
      w.__quadros.push({ t: performance.now() - t0, alvoPresente: Boolean(elAlvo), alvoOp: elAlvo ? w.__opacidadeEfetiva(elAlvo) : -1, irmaoY: elIrmao ? elIrmao.getBoundingClientRect().y : -1 });
      if (performance.now() - t0 < duracao) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, { funcoes: FUNCOES_DE_MOVIMENTO, alvo, irmao, duracao: duracaoMs });
}

async function lerQuadros(page: Page, aguardarMs: number): Promise<Quadro[]> {
  await page.waitForTimeout(aguardarMs);
  return page.evaluate(() => (window as unknown as { __quadros: Quadro[] }).__quadros);
}

function semearAvisos(api: import('./apiSimulada').ApiSimulada) {
  api.notices.push({ ...api.notices[0], id: 2, title: 'Segundo aviso' }, { ...api.notices[0], id: 3, title: 'Terceiro aviso' });
}

test.describe('excluir aviso', () => {
  test('o aviso sai com fade e o de baixo SOBE suavemente (sem pulo)', async ({ page, api }, info) => {
    semearAvisos(api);
    api.atrasar(/^\/api\/notices\/1$/, 1500, 'DELETE');
    controlarConfirmacoes(page).aceitar = true;
    await entrarComoRh(page);
    await page.goto('/avisos');
    await expect(page.getByText('Terceiro aviso').first()).toBeVisible();
    await page.waitForTimeout(900); // a entrada da lista terminou

    await amostrar(page, 'Recesso de fim de ano', 'Terceiro aviso', 1200);
    await page.getByRole('button', { name: /Excluir$/ }).first().click();
    const q = await lerQuadros(page, 1300);
    const antes = q.filter((x) => x.irmaoY >= 0);
    const y0 = antes[0].irmaoY;
    const yf = antes[antes.length - 1].irmaoY;

    // Fade: houve opacidade intermediária e depois o item sumiu.
    expect(q.some((x) => x.alvoPresente && x.alvoOp > 0 && x.alvoOp < 0.99), 'sem fade de saída').toBe(true);
    expect(q[q.length - 1].alvoPresente).toBe(false);
    // Colapso: o vizinho andou de y0 até yf passando por posições intermediárias, em ordem, sem salto único.
    expect(yf).toBeLessThan(y0 - 20);
    const intermediarios = antes.filter((x) => x.irmaoY < y0 - 1 && x.irmaoY > yf + 1);
    expect(intermediarios.length, 'o vizinho pulou em vez de deslizar').toBeGreaterThanOrEqual(2);
    for (let i = 1; i < antes.length; i++) expect(antes[i].irmaoY).toBeLessThanOrEqual(antes[i - 1].irmaoY + 1);
    const maiorSalto = Math.max(...antes.slice(1).map((x, i) => Math.abs(x.irmaoY - antes[i].irmaoY)));
    expect(maiorSalto, `maior salto em um quadro: ${maiorSalto}px`).toBeLessThan((y0 - yf) * 0.75);
    const saida = q.find((x) => !x.alvoPresente);
    info.annotations.push({ type: 'tempo', description: `Excluir aviso: item some em ${Math.round(saida?.t ?? -1)} ms; vizinho desliza ${Math.round(y0 - yf)} px em ${intermediarios.length} quadros` });
  });

  test('com a API falhando, o aviso VOLTA com fade e o vizinho desce de volta ao lugar', async ({ page, api }) => {
    semearAvisos(api);
    api.atrasar(/^\/api\/notices\/1$/, 1000, 'DELETE');
    api.falharProximas('DELETE', /^\/api\/notices\/1$/, 1);
    controlarConfirmacoes(page).aceitar = true;
    await entrarComoRh(page);
    await page.goto('/avisos');
    await expect(page.getByText('Terceiro aviso').first()).toBeVisible();
    await page.waitForTimeout(900);

    await amostrar(page, 'Recesso de fim de ano', 'Terceiro aviso', 3000);
    await page.getByRole('button', { name: /Excluir$/ }).first().click();
    const q = await lerQuadros(page, 3200);
    const y0 = q.find((x) => x.irmaoY >= 0)?.irmaoY ?? -1;
    const sumiu = q.findIndex((x) => !x.alvoPresente);
    expect(sumiu, 'o item nunca saiu').toBeGreaterThan(0);
    const depois = q.slice(sumiu);
    const voltou = depois.findIndex((x) => x.alvoPresente);
    expect(voltou, 'o item não voltou no rollback').toBeGreaterThan(0);
    const aposVolta = depois.slice(voltou);
    // Volta com fade: valores intermediários e termina opaco.
    expect(aposVolta.some((x) => x.alvoOp > 0 && x.alvoOp < 0.99), 'sem fade de volta').toBe(true);
    expect(aposVolta[aposVolta.length - 1].alvoOp).toBeGreaterThanOrEqual(0.999);
    // E o de baixo volta ao lugar de antes.
    expect(Math.abs(q[q.length - 1].irmaoY - y0)).toBeLessThan(2);
    await expect(page.getByText('Erro interno simulado')).toBeVisible();
  });
});

test('aprovar pendente: o cartão sai da fila logo e o de baixo não pula', async ({ page, api }) => {
  api.absences.push({ ...api.absences[0], id: 7, employee_id: 3, employee_name: 'Carla Dias', reason: 'Consulta médica' });
  api.atrasar(/^\/api\/absences\/1$/, 1500, 'PATCH');
  await entrarComoRh(page);
  await page.goto('/ferias');
  await expect(page.getByText('Consulta médica').first()).toBeVisible();
  await page.waitForTimeout(900);

  await amostrar(page, 'Viagem em família', 'Consulta médica', 1000);
  await page.getByRole('button', { name: /Aprovar/ }).first().click();
  const q = await lerQuadros(page, 1100);
  const y = q.filter((x) => x.irmaoY >= 0).map((x) => x.irmaoY);
  expect(q.some((x) => x.alvoPresente && x.alvoOp > 0 && x.alvoOp < 0.99), 'sem fade de saída do cartão').toBe(true);
  // O cartão de baixo sobe de forma contínua (passa por posições intermediárias, nunca volta para baixo).
  expect(y[y.length - 1]).toBeLessThan(y[0] - 20);
  for (let i = 1; i < y.length; i++) expect(y[i]).toBeLessThanOrEqual(y[i - 1] + 1);
  expect(y.filter((v) => v < y[0] - 1 && v > y[y.length - 1] + 1).length).toBeGreaterThanOrEqual(2);
});
