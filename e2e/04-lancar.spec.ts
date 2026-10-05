// Fluxo (d): lançar falta pela Equipe (payload exato) e Folga sem horas (Salvar desabilitado).

import { entrarComoRh, expect, test } from './base';
import { hojeIso } from './apiSimulada';

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
  await page.goto('/colaboradores');
  await page.getByRole('button', { name: /para Ana Souza$/ }).click();
  await expect(page.getByText('Falta, folga, hora extra, férias ou licença.')).toBeVisible();
});

test('lançar falta (dia inteiro, hoje) envia exatamente o payload esperado', async ({ page, api }) => {
  // A pessoa da linha já vem escolhida.
  await expect(page.getByRole('button', { name: 'Trocar colaborador' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Faltou', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Salvar lançamento' }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/absences$/).length).toBe(1);
  const hoje = hojeIso();
  expect(api.escritasDe('POST', /^\/api\/absences$/)[0].corpo).toEqual({ employee_id: 1, type: 'falta', start_date: hoje, end_date: hoje });
  // Modal fecha depois de salvar.
  await expect(page.getByRole('button', { name: 'Salvar lançamento' })).toBeHidden();
});

test('folga sem horas: Salvar fica desabilitado e não envia nada; com horas, envia', async ({ page, api }) => {
  await page.getByRole('radio', { name: 'Folga', exact: true }).click();
  const salvar = page.getByRole('button', { name: 'Salvar lançamento' });
  await expect(salvar).toBeDisabled();
  await salvar.click({ force: true });
  expect(api.escritasDe('POST', /absences/)).toHaveLength(0);

  await page.getByRole('radio', { name: '4h', exact: true }).click();
  await expect(salvar).toBeEnabled();
  await salvar.click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/absences$/).length).toBe(1);
  const hoje = hojeIso();
  expect(api.escritasDe('POST', /^\/api\/absences$/)[0].corpo).toEqual({ employee_id: 1, type: 'folga', start_date: hoje, end_date: hoje, hours: 4 });
});
