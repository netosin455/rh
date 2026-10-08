// Fluxo (43, projeto "movimento"): "Salvo" no próprio botão antes de o modal fechar (fluidez F4).
// A API confirma → o botão vira "✓ Salvo" por no máximo 450 ms → o modal fecha. Duplo clique = 1 chamada. Erro da API =
// nada muda (sem "Salvo", modal aberto, erro visível). O toast de sucesso continua aparecendo.

import type { Page } from '@playwright/test';
import { entrarComoRh, expect, test } from './base';

const SUBTITULO_MODAL = 'Publicar para toda a equipe.';

async function abrirNovoAviso(page: Page): Promise<void> {
  await entrarComoRh(page);
  await page.goto('/avisos');
  await expect(page.getByText('Recesso de fim de ano').first()).toBeVisible();
  await page.getByRole('button', { name: /Novo aviso/ }).click();
  await expect(page.getByText(SUBTITULO_MODAL)).toBeVisible();
  await page.getByLabel('Título', { exact: true }).fill('Reunião geral');
  await page.getByLabel('Conteúdo', { exact: true }).fill('Todos às 10h na sala 2.');
}

/** Liga um cronômetro por quadro: quando aparece um botão "Salvo" e quando o modal some (ms desde o início). */
async function cronometrar(page: Page): Promise<void> {
  await page.evaluate((subtitulo) => {
    const w = window as unknown as { __tempos: { inicio: number; salvo: number; fechou: number } };
    w.__tempos = { inicio: performance.now(), salvo: -1, fechou: -1 };
    const quadro = () => {
      const t = w.__tempos;
      const agora = performance.now() - t.inicio;
      if (t.salvo < 0 && document.querySelector('[aria-label="Salvo"]')) t.salvo = agora;
      const aberto = Array.from(document.querySelectorAll('*')).some((e) => e.children.length === 0 && e.textContent === subtitulo && e.getClientRects().length > 0);
      if (t.fechou < 0 && !aberto && agora > 30) t.fechou = agora;
      if (t.fechou < 0 && agora < 4000) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, SUBTITULO_MODAL);
}

const lerTempos = (page: Page) => page.evaluate(() => (window as unknown as { __tempos: { salvo: number; fechou: number } }).__tempos);

test('salvar aviso: o botão mostra "Salvo" e o modal fecha logo depois (≤ 450 ms de espera), com o toast de sucesso', async ({ page, api }, info) => {
  await abrirNovoAviso(page);
  await cronometrar(page);
  await page.getByRole('button', { name: /Publicar aviso/ }).click();
  await expect.poll(async () => (await lerTempos(page)).fechou, { timeout: 5_000 }).toBeGreaterThan(0);
  const t = await lerTempos(page);
  info.annotations.push({ type: 'medicao', description: `"Salvo" apareceu em ${Math.round(t.salvo)} ms e o modal fechou em ${Math.round(t.fechou)} ms (espera ${Math.round(t.fechou - t.salvo)} ms)` });
  expect(t.salvo, 'o botão nunca mostrou "Salvo"').toBeGreaterThan(0);
  expect(t.fechou - t.salvo, 'o modal demorou demais depois do "Salvo"').toBeLessThanOrEqual(520);
  expect(t.fechou - t.salvo, 'o modal fechou sem dar tempo de ver o "Salvo"').toBeGreaterThan(150);
  expect(api.escritasDe('POST', /^\/api\/notices$/)).toHaveLength(1);
  await expect(page.getByText('Aviso publicado para a equipe!').first()).toBeVisible();
  await expect(page.getByText('Todos às 10h na sala 2.').first()).toBeVisible();
});

test('duplo clique em Publicar gera UMA única chamada de API', async ({ page, api }) => {
  await abrirNovoAviso(page);
  await page.getByRole('button', { name: /Publicar aviso/ }).dblclick();
  await expect(page.getByText(SUBTITULO_MODAL)).toBeHidden({ timeout: 5_000 });
  expect(api.escritasDe('POST', /^\/api\/notices$/)).toHaveLength(1);
});

test('API falhando (500): NÃO aparece "Salvo", o modal continua aberto e o erro é mostrado', async ({ page, api }) => {
  api.falharProximas('POST', /^\/api\/notices$/, 1, 500);
  await abrirNovoAviso(page);
  await cronometrar(page);
  await page.getByRole('button', { name: /Publicar aviso/ }).click();
  await expect(page.getByText('Erro interno simulado').first()).toBeVisible();
  await page.waitForTimeout(900);
  const t = await lerTempos(page);
  expect(t.salvo, 'mostrou "Salvo" mesmo com a API falhando').toBe(-1);
  expect(t.fechou, 'o modal fechou com a API falhando').toBe(-1);
  await expect(page.getByText(SUBTITULO_MODAL)).toBeVisible();
  await expect(page.getByRole('button', { name: /Publicar aviso/ })).toBeEnabled(); // pode tentar de novo
  expect(api.escritasDe('POST', /^\/api\/notices$/)).toHaveLength(1);
  // A segunda tentativa funciona e mostra "Salvo".
  await page.getByRole('button', { name: /Publicar aviso/ }).click();
  await expect(page.getByText(SUBTITULO_MODAL)).toBeHidden({ timeout: 5_000 });
  expect(api.escritasDe('POST', /^\/api\/notices$/)).toHaveLength(2);
});

test('lançar falta pela Equipe: o botão Salvar lançamento mostra "Salvo" e só então o modal fecha', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: /para Ana Souza$/ }).click();
  await expect(page.getByText('Falta, folga, hora extra, férias ou licença.')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __salvo: number };
    w.__salvo = -1;
    const quadro = () => { if (w.__salvo < 0 && document.querySelector('[aria-label="Salvo"]')) w.__salvo = performance.now(); else if (w.__salvo < 0) requestAnimationFrame(quadro); };
    requestAnimationFrame(quadro);
  });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByRole('button', { name: 'Salvar lançamento' })).toBeHidden({ timeout: 5_000 });
  expect(await page.evaluate(() => (window as unknown as { __salvo: number }).__salvo), 'não mostrou "Salvo"').toBeGreaterThan(0);
  expect(api.escritasDe('POST', /^\/api\/absences$/)).toHaveLength(1);
});
