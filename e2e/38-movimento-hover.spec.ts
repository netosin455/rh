// Fluxo (38, projeto "movimento"): realce ao passar o mouse em Card/ListRow clicáveis (fluidez F3).
// Sobe 1 px + sombra em 140 ms, sem mudar o layout (CLS 0), sem bloquear o clique, e sem nada disso com movimento reduzido.

import { entrarComoRh, expect, test } from './base';

test('Card clicável: o mouse em cima eleva 1 px e acende a sombra; sair volta; o layout dos vizinhos não muda', async ({ page }) => {
  await entrarComoRh(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number }[]) w.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  const cartao = page.getByRole('button', { name: /^Equipe hoje:/ });
  await expect(cartao).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const outro = page.getByText('Precisa de você');

  const antes = await cartao.evaluate((el) => ({ topo: el.getBoundingClientRect().top, alt: (el as HTMLElement).offsetHeight, larg: (el as HTMLElement).offsetWidth }));
  const vizinhoAntes = await outro.evaluate((el) => el.getBoundingClientRect().top);
  await cartao.hover();
  await page.waitForTimeout(300);
  const em = await cartao.evaluate((el) => {
    const camada = el.querySelector('div[style*="box-shadow"], div[style*="boxShadow"]') as HTMLElement | null;
    return { topo: el.getBoundingClientRect().top, alt: (el as HTMLElement).offsetHeight, larg: (el as HTMLElement).offsetWidth, sombra: camada ? Number(getComputedStyle(camada).opacity) : -1 };
  });
  expect(antes.topo - em.topo, 'eleva exatamente 1 px').toBeCloseTo(1, 1);
  expect(em.sombra, 'a camada de sombra aparece').toBeGreaterThan(0.95);
  // Layout: tamanho do cartão e posição do vizinho não mudam (é só transform).
  expect([em.alt, em.larg]).toEqual([antes.alt, antes.larg]);
  expect(await outro.evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo(vizinhoAntes, 1);

  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  const fora = await cartao.evaluate((el) => el.getBoundingClientRect().top);
  expect(fora).toBeCloseTo(antes.topo, 1);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), 'CLS durante o hover').toBeLessThan(0.01);
});

test('Card e ListRow: o clique funciona com o mouse em cima (a camada de sombra não intercepta) e logo no 1º instante do hover', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/');
  const cartao = page.getByRole('button', { name: /^Equipe hoje:/ });
  await expect(cartao).toBeVisible({ timeout: 10_000 });
  await cartao.hover();
  // Sem esperar a animação: clica no mesmo instante.
  await cartao.click({ delay: 0 });
  await expect(page).toHaveURL(/\/colaboradores/);

  await page.goto('/avisos');
  const linha = page.getByRole('button', { name: /^(Expandir|Recolher) aviso/ }).first();
  await expect(linha).toBeVisible({ timeout: 10_000 });
  await linha.hover();
  const topoAntes = await linha.evaluate((el) => el.getBoundingClientRect().top);
  await page.waitForTimeout(300);
  const topoDepois = await linha.evaluate((el) => el.getBoundingClientRect().top);
  expect(topoAntes - topoDepois, 'a linha sobe no hover (no máximo 1 px)').toBeLessThanOrEqual(1.05);
  const rotuloAntes = await linha.getAttribute('aria-label');
  await linha.click();
  await expect(page.getByRole('button', { name: new RegExp(`^${(rotuloAntes ?? '').startsWith('Expandir') ? 'Recolher' : 'Expandir'} aviso`) }).first()).toBeVisible();
});

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('o hover não eleva nem acende sombra (instantâneo e sem deslocamento)', async ({ page }) => {
    await entrarComoRh(page);
    await page.goto('/');
    const cartao = page.getByRole('button', { name: /^Equipe hoje:/ });
    await expect(cartao).toBeVisible({ timeout: 10_000 });
    const antes = await cartao.evaluate((el) => el.getBoundingClientRect().top);
    await cartao.hover();
    await page.waitForTimeout(300);
    expect(await cartao.evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo(antes, 1);
  });
});
