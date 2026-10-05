// Fluxo (20, celular 390x844): sem sidebar, abas inferiores, navegação, Lançar falta e sem rolagem horizontal.

import { entrarComoRh, expect, semRolagemHorizontal, test } from './base';
import { hojeIso } from './apiSimulada';

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
});

test('sem sidebar, com abas inferiores; navega pelas abas sem rolagem horizontal', async ({ page }) => {
  await page.goto('/');
  const abas = page.getByRole('tablist');
  await expect(abas).toBeVisible();
  // A sidebar (itens "Abrir X") só existe na web larga.
  await expect(page.getByRole('tab', { name: /^Abrir / })).toHaveCount(0);
  await expect(abas.getByRole('tab')).toHaveCount(5);
  await semRolagemHorizontal(page);

  await abas.getByRole('tab', { name: /Equipe/ }).click();
  await expect(page).toHaveURL(/\/colaboradores$/);
  await expect(page.getByRole('button', { name: /^Abrir perfil de / })).toHaveCount(5);
  await semRolagemHorizontal(page);

  await abas.getByRole('tab', { name: /Férias/ }).click();
  await expect(page).toHaveURL(/\/ferias$/);
  await expect(page.getByText('Aguardando aprovação')).toBeVisible();
  await semRolagemHorizontal(page);

  await abas.getByRole('tab', { name: /Agenda/ }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await semRolagemHorizontal(page);

  await abas.getByRole('tab', { name: /Mais/ }).click();
  await expect(page).toHaveURL(/\/mais$/);
  await expect(page.getByText('Mais opções')).toBeVisible();
  await semRolagemHorizontal(page);

  // "Mais" leva às áreas que não cabem nas abas.
  await page.getByRole('button', { name: 'Abrir NPS' }).click();
  await expect(page).toHaveURL(/\/nps$/);
  await semRolagemHorizontal(page);
});

test('lançar falta pelo celular envia o payload exato e o modal não vaza a largura', async ({ page, api }) => {
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: /para Ana Souza$/ }).click();
  await expect(page.getByRole('button', { name: 'Salvar lançamento' })).toBeVisible();
  await semRolagemHorizontal(page);

  // O modal cabe na tela: o botão Salvar está dentro da largura de 390 px.
  const caixa = await page.getByRole('button', { name: 'Salvar lançamento' }).boundingBox();
  expect(caixa).not.toBeNull();
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(390);

  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect.poll(() => api.escritasDe('POST', /^\/api\/absences$/).length).toBe(1);
  const hoje = hojeIso();
  expect(api.escritasDe('POST', /^\/api\/absences$/)[0].corpo).toEqual({ employee_id: 1, type: 'falta', start_date: hoje, end_date: hoje });
});
