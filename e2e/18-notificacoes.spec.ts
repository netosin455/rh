// Fluxo (18): Notificações — listar, marcar uma como lida, marcar todas e o badge do sino.

import { entrarComoRh, expect, test } from './base';

test('badge do sino, marcar uma como lida e marcar todas (o badge acompanha)', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/');
  const sino = (rotulo: RegExp) => page.getByRole('button', { name: rotulo });
  await expect(sino(/^Abrir notificações, 2 não lidas$/)).toBeVisible();

  await sino(/^Abrir notificações/).click();
  await expect(page).toHaveURL(/\/notificacoes$/);
  await expect(page.getByRole('button', { name: /Férias aprovadas/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pesquisa encerrada/ })).toBeVisible();

  // Uma lida: PATCH {id}.
  await page.getByRole('button', { name: /Férias aprovadas/ }).click();
  await expect.poll(() => api.escritasDe('PATCH', /notifications=1/).length).toBe(1);
  expect(api.escritasDe('PATCH', /notifications=1/)[0].corpo).toEqual({ id: 1 });

  // Todas: PATCH {all:true} e o botão some.
  await page.getByRole('button', { name: 'Marcar todas as notificações como lidas' }).click();
  await expect.poll(() => api.escritasDe('PATCH', /notifications=1/).length).toBe(2);
  expect(api.escritasDe('PATCH', /notifications=1/)[1].corpo).toEqual({ all: true });
  await expect(page.getByRole('button', { name: 'Marcar todas as notificações como lidas' })).toHaveCount(0);

  // Voltando, o sino não mostra mais contagem (sem esperar o ciclo de 2 minutos do polling).
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(sino(/^Abrir notificações$/)).toBeVisible();
});
