// Fluxo (34, projeto "desktop", movimento REDUZIDO): com "reduzir movimento" nada anima e tudo é imediato.

import { amostrarNoCarregamento, entrarComoRh, expect, itemDaSidebar, lerAmostragem, test } from './base';

const LANCAR = '[aria-label^="Lançar falta, folga"]';

/** Animações/transições de duração finita ativas na página (as infinitas, como brilho de esqueleto, não contam). */
function animacoesFinitasAtivas(): number {
  return document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity && a.playState === 'running').length;
}

test('com movimento reduzido a lista já nasce opaca, sem deslocamento e sem animação em curso', async ({ page, api }) => {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  api.atrasar(/^\/api\/employees\?/, 300, 'GET');
  await entrarComoRh(page);
  await amostrarNoCarregamento(page, LANCAR, 5);
  await page.goto('/colaboradores');
  const a = await lerAmostragem(page);

  // Imediato: no primeiro quadro em que as linhas existem, já estão 100% opacas (todas as opacidades amostradas = 1).
  expect(a.opacidadesDoUltimo.every((o) => o >= 0.999), `opacidades: ${a.opacidadesDoUltimo.join(',')}`).toBe(true);
  expect(a.opacoMs - a.visivelMs).toBeLessThan(50);
  await expect.poll(() => page.evaluate(animacoesFinitasAtivas)).toBe(0);
});

test('com movimento reduzido, trocar de tela e excluir item não deixam animação nem transição ativas', async ({ page, api }) => {
  api.notices.push({ ...api.notices[0], id: 2, title: 'Segundo aviso' });
  await entrarComoRh(page);
  await page.goto('/avisos');
  await expect(page.getByText('Segundo aviso').first()).toBeVisible();
  await itemDaSidebar(page, 'Equipe').click();
  await expect(page.locator(LANCAR)).toHaveCount(5);
  expect(await page.evaluate(animacoesFinitasAtivas)).toBe(0);
  await itemDaSidebar(page, 'Avisos').click();
  await expect(page.getByText('Segundo aviso').first()).toBeVisible();
  expect(await page.evaluate(animacoesFinitasAtivas)).toBe(0);

  page.once('dialog', (d) => { void d.accept(); });
  await page.getByRole('button', { name: /Excluir$/ }).first().click();
  // O item sai no mesmo instante (nada de fade): some do DOM sem esperar animação.
  await expect(page.getByText('Recesso de fim de ano')).toHaveCount(0, { timeout: 300 });
  expect(await page.evaluate(animacoesFinitasAtivas)).toBe(0);
});

test('nenhum elemento da tela tem transição CSS longa configurada com movimento reduzido', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.locator(LANCAR)).toHaveCount(5);
  const lentos = await page.evaluate(() => Array.from(document.querySelectorAll('body *'))
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => getComputedStyle(el))
    .filter((cs) => cs.animationName !== 'none' && cs.animationIterationCount !== 'infinite' && parseFloat(cs.animationDuration) > 0.001).length);
  expect(lentos).toBe(0);
});
