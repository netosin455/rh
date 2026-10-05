// Fluxo (14): Onboarding — lista, abrir um processo, concluir e reabrir uma etapa (payload).

import { entrarComoRh, expect, itemAtivoDaSidebar, test } from './base';

test('abrir o processo e marcar/desmarcar uma etapa', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/onboarding');
  await expect(page.getByText('Carla Dias').first()).toBeVisible();
  await expect(page.getByText('0/3 etapas')).toBeVisible();
  await expect.poll(() => itemAtivoDaSidebar(page)).toEqual(['Abrir Onboarding']);

  await page.getByRole('button', { name: /Abrir$/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  await expect(page.getByText('Assinar contrato')).toBeVisible();
  await expect(page.getByRole('button', { name: /Concluir etapa/ })).toHaveCount(3);

  await page.getByRole('button', { name: /Concluir etapa/ }).first().click();
  await expect.poll(() => api.escritasDe('PATCH', /^\/api\/onboarding\/1\/step$/).length).toBe(1);
  expect(api.escritasDe('PATCH', /^\/api\/onboarding\/1\/step$/)[0].corpo).toEqual({ step_index: 0, completed: true });
  await expect(page.getByText(/Concluído por Ana Paula RH/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Reabrir etapa/ })).toHaveCount(1);
  await expect(page.getByText('1/3', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Reabrir etapa/ }).click();
  await expect.poll(() => api.escritasDe('PATCH', /step$/).length).toBe(2);
  expect(api.escritasDe('PATCH', /step$/)[1].corpo).toEqual({ step_index: 0, completed: false });
  await expect(page.getByText('0/3', { exact: true })).toBeVisible();
  // A sidebar continua com Onboarding ativo dentro do detalhe.
  await expect.poll(() => itemAtivoDaSidebar(page)).toEqual(['Abrir Onboarding']);
});
