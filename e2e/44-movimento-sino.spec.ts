// Fluxo (44, projeto "movimento"): sino de notificações e badge (fluidez F4).
// O sino balança UMA vez (±12°, ~400 ms) quando o contador de não lidas SOBE; o badge dá o "pop" (escala 1 → 1,15 → 1).
// Nunca na carga inicial nem quando o contador desce. O contador é relido a cada 2 min (Contadores): usamos o relógio
// do Playwright para pular o intervalo depois de mexer nos dados da API simulada.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, test } from './base';
import { agoraIso } from './apiSimulada';

interface Quadro { graus: number; escala: number }

/** Liga, na página, a gravação por quadro do ângulo do sino e da escala do badge. Devolve uma função de leitura. */
async function ligarGravacao(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __sino: Quadro[]; __gravando: boolean };
    w.__sino = [];
    w.__gravando = true;
    const quadro = () => {
      const sino = document.querySelector('[data-testid="sino-notificacoes"]');
      const badge = document.querySelector('[data-testid="badge-sino"]');
      if (sino) {
        const m = new DOMMatrixReadOnly(getComputedStyle(sino).transform === 'none' ? undefined : getComputedStyle(sino).transform);
        const b = badge ? new DOMMatrixReadOnly(getComputedStyle(badge).transform === 'none' ? undefined : getComputedStyle(badge).transform) : null;
        w.__sino.push({ graus: Math.atan2(m.b, m.a) * (180 / Math.PI), escala: b ? b.a : 1 });
      }
      if (w.__gravando) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  });
}

const zerarGravacao = (page: Page) => page.evaluate(() => { (window as unknown as { __sino: Quadro[] }).__sino = []; });
const lerGravacao = (page: Page) => page.evaluate(() => (window as unknown as { __sino: Quadro[] }).__sino);

/** Quantos "balanços" separados existem: trechos com |ângulo| > 0,5° separados por ≥ 20 quadros parados. */
function contarEpisodios(serie: Quadro[]): number {
  let episodios = 0;
  let parados = 99;
  for (const q of serie) {
    if (Math.abs(q.graus) > 0.5) { if (parados >= 20) episodios += 1; parados = 0; } else parados += 1;
  }
  return episodios;
}

const maxAngulo = (serie: Quadro[]) => Math.max(0, ...serie.map((q) => Math.abs(q.graus)));
const maxEscala = (serie: Quadro[]) => Math.max(1, ...serie.map((q) => q.escala));

async function pularIntervaloDosContadores(page: Page): Promise<void> {
  await page.clock.fastForward(121_000);
}

test('o sino balança uma única vez quando o contador sobe, e o badge dá o pop', async ({ page, api }, info) => {
  await page.clock.install();
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Abrir notificações, 2 não lidas/ })).toBeVisible({ timeout: 10_000 });
  await ligarGravacao(page);
  await page.waitForTimeout(1_500);

  // Carga inicial: nada se mexeu.
  const inicial = await lerGravacao(page);
  expect(inicial.length).toBeGreaterThan(10);
  expect(maxAngulo(inicial), 'o sino balançou na carga inicial').toBeLessThan(0.5);
  expect(maxEscala(inicial), 'o badge deu pop na carga inicial').toBeLessThan(1.02);

  // Chega uma notificação nova: o contador sobe de 2 para 3.
  await zerarGravacao(page);
  api.notificacoes.unshift({ id: 99, title: 'Nova notícia', body: null, type: 'aviso', route: null, read: false, created_at: agoraIso() });
  await pularIntervaloDosContadores(page);
  await expect(page.getByRole('button', { name: /Abrir notificações, 3 não lidas/ })).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(1_300);
  const subida = await lerGravacao(page);
  info.annotations.push({ type: 'medicao', description: `Sino na subida: ângulo máx. ${maxAngulo(subida).toFixed(1)}°, pop do badge até ${maxEscala(subida).toFixed(2)}, episódios ${contarEpisodios(subida)}` });
  expect(maxAngulo(subida), 'o sino não balançou').toBeGreaterThan(8);
  expect(maxAngulo(subida), 'o sino balançou além de ±12°').toBeLessThan(13.5);
  expect(contarEpisodios(subida), 'o sino balançou mais de uma vez').toBe(1);
  expect(maxEscala(subida), 'o badge não deu o pop').toBeGreaterThan(1.08);
  expect(maxEscala(subida)).toBeLessThan(1.2);
  expect(Math.abs(subida[subida.length - 1].graus), 'o sino não voltou ao repouso').toBeLessThan(0.5);
  expect(subida[subida.length - 1].escala).toBeCloseTo(1, 2);

  // O contador DESCE (tudo lido): sem balanço nem pop.
  await zerarGravacao(page);
  api.notificacoes.forEach((n) => { n.read = true; });
  await pularIntervaloDosContadores(page);
  await expect(page.getByRole('button', { name: 'Abrir notificações' })).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(900);
  const descida = await lerGravacao(page);
  expect(maxAngulo(descida), 'o sino balançou quando o contador desceu').toBeLessThan(0.5);
  expect(maxEscala(descida)).toBeLessThan(1.02);
});

test('o clique no sino abre as notificações no 1º instante, mesmo durante o balanço', async ({ page, api }) => {
  await page.clock.install();
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Abrir notificações, 2 não lidas/ })).toBeVisible({ timeout: 10_000 });
  api.notificacoes.unshift({ id: 98, title: 'Outra', body: null, type: 'aviso', route: null, read: false, created_at: agoraIso() });
  await pularIntervaloDosContadores(page);
  const sino = page.getByRole('button', { name: /Abrir notificações, 3 não lidas/ });
  await expect(sino).toBeVisible({ timeout: 5_000 });
  await sino.click({ force: true }); // sem esperar a animação terminar
  await expect(page).toHaveURL(/\/notificacoes/);
});
