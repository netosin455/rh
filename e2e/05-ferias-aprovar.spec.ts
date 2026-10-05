// Fluxo (e): aprovar uma ausência pendente em Férias.

import { entrarComoRh, expect, test } from './base';

test('aprovar a solicitação pendente: PATCH approved:true e o item sai da fila', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/ferias');

  const fila = page.getByText('Aguardando aprovação');
  await expect(fila).toBeVisible();
  // O motivo aparece no cartão da fila e, de novo, em "Registros".
  await expect(page.getByText('Viagem em família').first()).toBeVisible();

  await page.getByRole('button', { name: /Aprovar/ }).click();

  await expect.poll(() => api.escritasDe('PATCH', /^\/api\/absences\/1$/).length).toBe(1);
  expect(api.escritasDe('PATCH', /^\/api\/absences\/1$/)[0].corpo).toEqual({ approved: true });

  // Sai da fila de pendentes e passa a constar como aprovada nos registros.
  await expect(fila).toBeHidden();
  await expect(page.getByRole('button', { name: /Aprovar/ })).toHaveCount(0);
  await expect(page.getByLabel('Aprovado').first()).toBeVisible();
});
