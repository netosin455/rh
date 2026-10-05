// Fluxo (24): Agenda — editar (formulário com DateField/TimeField, payload exato) e excluir evento com confirmação.

import { controlarConfirmacoes, entrarComoRh, expect, test } from './base';
import { hojeIso } from './apiSimulada';

test.beforeEach(async ({ page, api }) => {
  api.semearEvento({ title: 'Audiência', date: hojeIso(), start_time: '09:00', end_time: '10:00', category: 'audiencia' });
  await entrarComoRh(page);
  await page.goto('/agenda');
  await expect(page.getByText('Audiência', { exact: true }).first()).toBeVisible();
});

test('editar abre o formulário preenchido e envia PUT com o payload exato', async ({ page, api }) => {
  await page.getByRole('button', { name: 'Editar evento Audiência' }).click();
  await expect(page.getByText('Altere os dados do evento.')).toBeVisible();
  await expect(page.getByLabel('Título')).toHaveValue('Audiência');
  await expect(page.getByLabel('Data')).toHaveValue(hojeIso());
  await expect(page.getByLabel('Início')).toHaveValue('09:00');
  await expect(page.getByLabel('Fim')).toHaveValue('10:00');

  await page.getByLabel('Título').fill('Audiência remarcada');
  await page.getByLabel('Fim').fill('11:30');
  // Fim antes do início: erro no campo e nada enviado.
  await page.getByLabel('Início').fill('12:00');
  await page.getByRole('button', { name: 'Salvar alterações do evento' }).click();
  await expect(page.getByText('O fim precisa ser depois do início.')).toBeVisible();
  expect(api.escritasDe('PUT', /events/)).toHaveLength(0);

  await page.getByLabel('Início').fill('09:30');
  await page.getByRole('button', { name: 'Salvar alterações do evento' }).click();

  await expect.poll(() => api.escritasDe('PUT', /^\/api\/events\/ev-1$/).length).toBe(1);
  expect(api.escritasDe('PUT', /^\/api\/events\/ev-1$/)[0].corpo).toEqual({
    title: 'Audiência remarcada', date: hojeIso(), start_time: '09:30', end_time: '11:30', category: 'audiencia', color: '#C9A84C', is_all_day: false,
  });
  await expect(page.getByText('Audiência remarcada').first()).toBeVisible();
  // Não criou um segundo evento.
  expect(api.escritasDe('POST', /events/)).toHaveLength(0);
});

test('excluir pede confirmação; cancelar mantém, confirmar apaga (DELETE)', async ({ page, api }) => {
  const confirmacoes = controlarConfirmacoes(page);
  await page.getByRole('button', { name: 'Excluir evento Audiência' }).click();
  expect(confirmacoes.mensagens[0]).toBe('Excluir evento\n\nExcluir o evento "Audiência"? Não dá para desfazer.');
  expect(api.escritasDe('DELETE', /events/)).toHaveLength(0);

  confirmacoes.aceitar = true;
  await page.getByRole('button', { name: 'Excluir evento Audiência' }).click();
  await expect.poll(() => api.escritasDe('DELETE', /^\/api\/events\/ev-1$/).length).toBe(1);
  await expect(page.getByText('Nenhum evento neste dia')).toBeVisible();
});
