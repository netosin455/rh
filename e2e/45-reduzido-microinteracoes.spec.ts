// Fluxo (45, movimento reduzido — padrão da suíte): micro-interações da F4 não animam, mas os ESTADOS mudam.
// Indicador salta direto; "Salvo" não espera (modal fecha na hora); sino e badge não se mexem, mas o número atualiza.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, test } from './base';
import { agoraIso } from './apiSimulada';

/** `ref`: testID de um elemento de referência — a posição é medida RELATIVA a ele (a rolagem horizontal da faixa de chips não conta). */
async function gravar(page: Page, testid: string, ms: number, ref?: string): Promise<{ x: number; escala: number; graus: number }[]> {
  return page.evaluate(({ id, duracao, ref }) => new Promise<{ x: number; escala: number; graus: number }[]>((resolver) => {
    const serie: { x: number; escala: number; graus: number }[] = [];
    const inicio = performance.now();
    const quadro = () => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) {
        const cs = getComputedStyle(el);
        const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
        const base = ref ? (document.querySelector(`[data-testid="${ref}"]`)?.getBoundingClientRect().left ?? 0) : 0;
        serie.push({ x: el.getBoundingClientRect().left - base, escala: m.a, graus: Math.atan2(m.b, m.a) * (180 / Math.PI) });
      }
      if (performance.now() - inicio < duracao) requestAnimationFrame(quadro); else resolver(serie);
    };
    requestAnimationFrame(quadro);
  }), { id: testid, duracao: ms, ref });
}

test('Equipe: com movimento reduzido o indicador salta direto para a opção nova (sem posições intermediárias) e a lista muda', async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await expect(page.locator('[aria-label^="Lançar falta, folga"]')).toHaveCount(5);
  const filtro = page.getByTestId('filtro-equipe');
  // Espera o indicador assentar (primeira posição) antes de gravar a troca.
  await expect.poll(() => page.getByTestId('filtro-equipe-indicador').evaluate((el) => parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  await page.waitForTimeout(500);
  const gravacao = gravar(page, 'filtro-equipe-indicador', 1_000, 'filtro-equipe');
  await filtro.getByRole('button', { name: 'Licença', exact: true }).click();
  await expect(page).toHaveURL(/status=licenca/);
  const serie = await gravacao;
  const alvo = await filtro.getByRole('button', { name: 'Licença', exact: true }).evaluate((el, ref) => (el.parentElement as HTMLElement).getBoundingClientRect().left - (document.querySelector(`[data-testid="${ref}"]`)?.getBoundingClientRect().left ?? 0), 'filtro-equipe');
  const distintos = [...new Set(serie.map((a) => Math.round(a.x)))];
  expect(distintos.length, `posições vistas: ${distintos.join(',')}`).toBeLessThanOrEqual(2); // antes e depois, sem trânsito
  expect(Math.abs(serie[serie.length - 1].x - alvo)).toBeLessThan(1.5);
  await expect(filtro.getByRole('button', { name: 'Licença', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Avisos: com movimento reduzido o modal fecha logo após a resposta (sem esperar o "Salvo") e o toast aparece', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/avisos');
  await expect(page.getByText('Recesso de fim de ano').first()).toBeVisible();
  await page.getByRole('button', { name: /Novo aviso/ }).click();
  await page.getByLabel('Título', { exact: true }).fill('Reunião geral');
  await page.getByLabel('Conteúdo', { exact: true }).fill('Todos às 10h na sala 2.');
  const inicio = Date.now();
  await page.getByRole('button', { name: /Publicar aviso/ }).click();
  await expect(page.getByText('Publicar para toda a equipe.')).toBeHidden({ timeout: 3_000 });
  expect(Date.now() - inicio, 'demorou para fechar com movimento reduzido').toBeLessThan(1_000);
  expect(api.escritasDe('POST', /^\/api\/notices$/)).toHaveLength(1);
  await expect(page.getByText('Aviso publicado para a equipe!').first()).toBeVisible();
});

test('Sino: com movimento reduzido o número do badge atualiza, mas o sino não balança nem o badge dá pop', async ({ page, api }) => {
  await page.clock.install();
  await entrarComoRh(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Abrir notificações, 2 não lidas/ })).toBeVisible({ timeout: 10_000 });
  api.notificacoes.unshift({ id: 99, title: 'Nova', body: null, type: 'aviso', route: null, read: false, created_at: agoraIso() });
  const sino = gravar(page, 'sino-notificacoes', 1_400);
  const badge = gravar(page, 'badge-sino', 1_400);
  await page.clock.fastForward(121_000);
  await expect(page.getByRole('button', { name: /Abrir notificações, 3 não lidas/ })).toBeVisible({ timeout: 5_000 });
  const [serieSino, serieBadge] = await Promise.all([sino, badge]);
  expect(Math.max(0, ...serieSino.map((q) => Math.abs(q.graus))), 'o sino balançou').toBeLessThan(0.5);
  expect(Math.max(1, ...serieBadge.map((q) => q.escala)), 'o badge deu pop').toBeLessThan(1.02);
  await expect(page.getByTestId('badge-sino')).toContainText('3');
});
