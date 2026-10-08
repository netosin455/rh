// Fluxo (42, projeto "movimento"): indicador que DESLIZA entre as opções de filtro (fluidez F4).
// Equipe (chips), Férias (abas) e Analytics (moldura no cartão de risco): o indicador nasce na posição certa (sem animar do
// zero), desliza de verdade ao trocar, termina exatamente sob a opção nova e a seleção NÃO espera a animação.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, test } from './base';

interface Amostra { x: number; y: number; w: number; o: number }

/** Grava (por quadro) posição/tamanho/opacidade do indicador durante `ms` e devolve a série. */
async function gravarIndicador(page: Page, testid: string, ms: number): Promise<Amostra[]> {
  return page.evaluate(({ id, duracao }) => new Promise<Amostra[]>((resolver) => {
    const serie: Amostra[] = [];
    const inicio = performance.now();
    const quadro = () => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) { const r = el.getBoundingClientRect(); serie.push({ x: r.left, y: r.top, w: r.width, o: parseFloat(getComputedStyle(el).opacity) }); }
      if (performance.now() - inicio < duracao) requestAnimationFrame(quadro); else resolver(serie);
    };
    requestAnimationFrame(quadro);
  }), { id: testid, duracao: ms });
}

async function retangulo(page: Page, seletor: string): Promise<{ x: number; y: number; w: number; h: number }> {
  return page.locator(seletor).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
}

test('Equipe: o indicador já nasce sob "Todos" (sem deslizar do zero) e desliza até "Ativos", com URL e lista certas', async ({ page }, info) => {
  await entrarComoRh(page);
  // Grava desde o carregamento: depois de posicionado, o indicador não pode se mexer sozinho.
  await page.addInitScript(() => {
    const w = window as unknown as { __carga: { x: number; o: number }[] };
    w.__carga = [];
    const inicio = performance.now();
    const quadro = () => {
      const el = document.querySelector('[data-testid="filtro-equipe-indicador"]');
      if (el) w.__carga.push({ x: el.getBoundingClientRect().left, o: parseFloat(getComputedStyle(el).opacity) });
      if (performance.now() - inicio < 15000) requestAnimationFrame(quadro); // máquina lenta: janela larga
    };
    requestAnimationFrame(quadro);
  });
  await page.goto('/colaboradores');
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
  await page.waitForTimeout(1_500);
  const carga = await page.evaluate(() => (window as unknown as { __carga: { x: number; o: number }[] }).__carga);
  const visiveis = carga.filter((a) => a.o > 0.9);
  expect(visiveis.length).toBeGreaterThan(3);
  expect(new Set(visiveis.map((a) => Math.round(a.x))).size, 'o indicador se mexeu depois de aparecer').toBe(1);

  const filtro = page.getByTestId('filtro-equipe');
  const todos = await retangulo(page, '[data-testid="filtro-equipe-indicador"]');
  const chipTodos = await filtro.getByRole('button', { name: 'Todos', exact: true }).evaluate((el) => el.parentElement?.getBoundingClientRect().left ?? -1);
  expect(Math.abs(todos.x - chipTodos)).toBeLessThan(1.5);

  // Troca: o clique age na hora (URL e lista no 1º instante) e o indicador percorre posições intermediárias.
  const gravacao = gravarIndicador(page, 'filtro-equipe-indicador', 900);
  await filtro.getByRole('button', { name: 'Ativos', exact: true }).click();
  await expect(page).toHaveURL(/status=ativo/);
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(4); // 1 está de férias
  const serie = await gravacao;

  const alvo = await filtro.getByRole('button', { name: 'Ativos', exact: true }).evaluate((el) => { const r = (el.parentElement as HTMLElement).getBoundingClientRect(); return { x: r.left, w: r.width }; });
  const final = serie[serie.length - 1];
  expect(Math.abs(final.x - alvo.x), `indicador parou em ${final.x}, opção em ${alvo.x}`).toBeLessThan(1.5);
  expect(Math.abs(final.w - alvo.w)).toBeLessThan(1.5);
  const xs = serie.map((a) => a.x);
  const meio = xs.filter((x) => x > Math.min(todos.x, alvo.x) + 2 && x < Math.max(todos.x, alvo.x) - 2);
  info.annotations.push({ type: 'medicao', description: `Indicador Equipe: ${todos.x.toFixed(0)} → ${alvo.x.toFixed(0)} px, ${meio.length} quadros intermediários` });
  expect(meio.length, 'o indicador saltou sem deslizar').toBeGreaterThan(2);

  // Voltar a "Todos" limpa a URL e devolve a lista inteira.
  await filtro.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
});

test('Equipe: o estado do chip (aria-pressed) muda no 1º instante, antes de o indicador chegar', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
  const ativos = page.getByTestId('filtro-equipe').getByRole('button', { name: 'Ativos', exact: true });
  await expect(ativos).toHaveAttribute('aria-pressed', 'false');
  await ativos.click();
  await expect(ativos).toHaveAttribute('aria-pressed', 'true', { timeout: 150 });
});

test('Férias: o destaque da aba desliza e termina sob a aba escolhida; ?tab= continua na URL', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/ferias');
  const filtro = page.getByTestId('filtro-ferias');
  await expect(filtro).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const aba = filtro.getByRole('button', { name: /^Filtrar por Férias$/ });
  const gravacao = gravarIndicador(page, 'filtro-ferias-indicador', 900);
  await aba.click();
  await expect(page).toHaveURL(/tab=ferias/);
  const serie = await gravacao;
  const alvo = await aba.evaluate((el) => (el.parentElement as HTMLElement).getBoundingClientRect().left);
  expect(Math.abs(serie[serie.length - 1].x - alvo)).toBeLessThan(1.5);
  expect(new Set(serie.map((a) => Math.round(a.x))).size, 'sem deslizamento').toBeGreaterThan(3);
});

test('Analytics: a moldura do risco desliza até o cartão escolhido; ?risco= continua na URL e o clique de novo limpa', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/analytics');
  const grade = page.getByTestId('filtro-risco');
  await expect(grade).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const medio = grade.getByRole('button', { name: /^Risco médio/ });
  const gravacao = gravarIndicador(page, 'filtro-risco-indicador', 900);
  await medio.click();
  await expect(page).toHaveURL(/risco=medio/);
  const serie = await gravacao;
  const alvo = await medio.evaluate((el) => (el.parentElement as HTMLElement).getBoundingClientRect().left);
  expect(Math.abs(serie[serie.length - 1].x - alvo)).toBeLessThan(1.5);
  expect(serie[serie.length - 1].o).toBeGreaterThan(0.9);

  await medio.click();
  await expect(page).not.toHaveURL(/risco=/);
  await expect.poll(() => page.getByTestId('filtro-risco-indicador').evaluate((el) => parseFloat(getComputedStyle(el).opacity))).toBeLessThan(0.05);
});
