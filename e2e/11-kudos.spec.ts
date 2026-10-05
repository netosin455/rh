// Fluxo (11): Reconhecimentos/Kudos — EmployeePicker com busca sem acento e envio com payload exato.

import { entrarComoRh, expect, test } from './base';

test('escolher a pessoa pela busca sem acento e publicar o reconhecimento', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/reconhecimentos');
  await page.getByRole('button', { name: /Dar kudos/ }).first().click();
  await expect(page.getByText('Quem você quer reconhecer?')).toBeVisible();

  // Sem digitar nada, a lista curta já mostra a equipe.
  await expect(page.getByRole('button', { name: 'Escolher Ana Souza' })).toBeVisible();

  // "juridico" (sem acento) acha só quem tem "Jurídico" no cargo.
  await page.getByLabel('Buscar colaborador').fill('juridico');
  await expect(page.getByRole('button', { name: 'Escolher Bruno Lima' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Escolher Ana Souza' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Escolher Bruno Lima' }).click();

  // Bruno não tem e-mail cadastrado: o app avisa.
  await expect(page.getByText(/não tem email cadastrado/)).toBeVisible();
  await page.getByRole('button', { name: /Liderança/ }).click();
  await page.getByLabel('Mensagem', { exact: true }).fill('Conduziu a audiência com muita calma.');
  await page.getByRole('button', { name: /Publicar reconhecimento/ }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/recognitions$/).length).toBe(1);
  expect(api.escritasDe('POST', /^\/api\/recognitions$/)[0].corpo).toEqual({
    to_employee_id: 2, message: 'Conduziu a audiência com muita calma.', category: 'lideranca',
  });
  await expect(page.getByText('Ana Paula RH reconheceu Bruno Lima')).toBeVisible();
});

test('"Publicar reconhecimento" fica desabilitado sem mensagem', async ({ page, api }) => {
  await entrarComoRh(page);
  await page.goto('/reconhecimentos');
  await page.getByRole('button', { name: /Dar kudos/ }).first().click();
  await page.getByRole('button', { name: 'Escolher Carla Dias' }).click();
  await expect(page.getByRole('button', { name: /Publicar reconhecimento/ })).toBeDisabled();
  expect(api.escritasDe('POST', /recognitions/)).toHaveLength(0);
});
