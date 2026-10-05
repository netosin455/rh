// Fluxo (f): Agenda — criar evento escolhendo data e hora; fim antes do início não envia.

import { entrarComoRh, expect, test } from './base';
import { hojeIso } from './apiSimulada';

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/agenda');
  await page.getByRole('button', { name: /Novo evento/ }).first().click();
  await expect(page.getByText('Audiência, reunião, prazo ou outro.')).toBeVisible();
});

test('criar evento com data e horário envia o payload exato', async ({ page, api }) => {
  const data = `${hojeIso().slice(0, 7)}-15`;
  await page.getByLabel('Título').fill('Reunião com cliente');
  await page.getByLabel('Data').fill(data);
  await page.getByLabel('Início').fill('14:00');
  await page.getByLabel('Fim').fill('15:30');
  await page.getByRole('button', { name: 'Selecionar Reunião' }).click();
  await page.getByRole('button', { name: /Salvar evento/ }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/events$/).length).toBe(1);
  expect(api.escritasDe('POST', /^\/api\/events$/)[0].corpo).toEqual({
    title: 'Reunião com cliente',
    date: data,
    start_time: '14:00',
    end_time: '15:30',
    category: 'reuniao',
    color: '#4A8FD4',
    is_all_day: false,
  });
  await expect(page.getByText('Audiência, reunião, prazo ou outro.')).toBeHidden();
});

test('fim antes do início mostra o erro no campo e NÃO envia', async ({ page, api }) => {
  await page.getByLabel('Título').fill('Prazo mal digitado');
  await page.getByLabel('Início').fill('15:00');
  await page.getByLabel('Fim').fill('14:00');
  await page.getByRole('button', { name: /Salvar evento/ }).click();

  await expect(page.getByText('O fim precisa ser depois do início.')).toBeVisible();
  expect(api.escritasDe('POST', /events/)).toHaveLength(0);

  // Corrigindo o fim, o erro some e o envio acontece.
  await page.getByLabel('Fim').fill('16:00');
  await page.getByRole('button', { name: /Salvar evento/ }).click();
  await expect.poll(() => api.escritasDe('POST', /^\/api\/events$/).length).toBe(1);
  expect(api.escritasDe('POST', /^\/api\/events$/)[0].corpo).toMatchObject({ title: 'Prazo mal digitado', start_time: '15:00', end_time: '16:00' });
});
