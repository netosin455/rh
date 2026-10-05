// Fluxo (10): Avisos — criar (payload exato, "Válido até" pelo DateField), fixar e excluir com confirmação.

import { entrarComoRh, expect, test } from './base';
import { hojeIso } from './apiSimulada';

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/avisos');
  await expect(page.getByText('Recesso de fim de ano').first()).toBeVisible();
});

test('criar aviso importante, fixado e com validade envia o payload exato', async ({ page, api }) => {
  await page.getByRole('button', { name: /Novo aviso/ }).click();
  await expect(page.getByText('Publicar para toda a equipe.')).toBeVisible();

  await page.getByLabel('Título', { exact: true }).fill('Reunião geral');
  await page.getByLabel('Conteúdo', { exact: true }).fill('Todos às 10h na sala 2.');
  await page.getByRole('button', { name: 'Prioridade Importante' }).click();
  await page.getByRole('button', { name: /Fixar no topo/ }).click();
  const validade = hojeIso(30);
  await page.getByLabel('Válido até').fill(validade);
  await page.getByRole('button', { name: /Publicar aviso/ }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/notices$/).length).toBe(1);
  expect(api.escritasDe('POST', /^\/api\/notices$/)[0].corpo).toEqual({
    title: 'Reunião geral', body: 'Todos às 10h na sala 2.', priority: 'importante', pinned: true, expires_at: validade,
  });
  // O novo aviso aparece já em "Fixados".
  await expect(page.getByText('Fixados')).toBeVisible();
  await expect(page.getByText('Todos às 10h na sala 2.').first()).toBeVisible();
});

test('aviso sem título ou sem conteúdo mostra o erro no campo e NÃO envia', async ({ page, api }) => {
  await page.getByRole('button', { name: /Novo aviso/ }).click();
  await page.getByRole('button', { name: /Publicar aviso/ }).click();
  await expect(page.getByText('Informe o título do aviso.').first()).toBeVisible();
  expect(api.escritasDe('POST', /notices/)).toHaveLength(0);
});

test('fixar e desafixar um aviso (PATCH pinned)', async ({ page, api }) => {
  await page.getByRole('button', { name: /Fixar$/ }).click();
  await expect.poll(() => api.escritasDe('PATCH', /^\/api\/notices\/1$/).length).toBe(1);
  expect(api.escritasDe('PATCH', /^\/api\/notices\/1$/)[0].corpo).toEqual({ pinned: true });
  await expect(page.getByText('Fixados')).toBeVisible();

  await page.getByRole('button', { name: /Desafixar$/ }).click();
  await expect.poll(() => api.escritasDe('PATCH', /^\/api\/notices\/1$/).length).toBe(2);
  expect(api.escritasDe('PATCH', /^\/api\/notices\/1$/)[1].corpo).toEqual({ pinned: false });
  await expect(page.getByText('Fixados')).toBeHidden();
});

test('excluir pede confirmação: cancelar não apaga; confirmar apaga', async ({ page, api }) => {
  page.once('dialog', (d) => { void d.dismiss(); });
  await page.getByRole('button', { name: /Excluir$/ }).click();
  expect(api.escritasDe('DELETE', /notices/)).toHaveLength(0);
  await expect(page.getByText('Recesso de fim de ano').first()).toBeVisible();

  page.once('dialog', (d) => { expect(d.message()).toContain('Recesso de fim de ano'); void d.accept(); });
  await page.getByRole('button', { name: /Excluir$/ }).click();
  await expect.poll(() => api.escritasDe('DELETE', /^\/api\/notices\/1$/).length).toBe(1);
  await expect(page.getByText('Nenhum aviso publicado')).toBeVisible();
});
