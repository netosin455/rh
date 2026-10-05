// Fluxo (25): Férias/lançamentos APROVADOS — excluir com a mensagem de saldo e editar horas de folga (422 no modal).

import { controlarConfirmacoes, entrarComoRh, expect, test } from './base';
import { hojeIso } from './apiSimulada';

test.beforeEach(async ({ page, api }) => {
  api.absences = []; // sem a solicitação pendente de exemplo: só os lançamentos de cada teste
  await entrarComoRh(page);
});

test('excluir folga aprovada explica o saldo e devolve as horas', async ({ page, api }) => {
  api.employees[0].folga_hours = 6; // Ana: já com as 4h descontadas
  api.semearAusencia({ employee_id: 1, type: 'folga', hours: 4 });
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/ferias');

  const excluir = page.getByRole('button', { name: 'Excluir', exact: true });
  await excluir.click();
  expect(confirmacoes.mensagens[0]).toBe('Excluir lançamento\n\nExcluir Folga de Ana Souza? As 4h de folga voltam ao banco de horas de Ana; saldo passa de 6h para 10h.');
  expect(api.escritasDe('DELETE', /absences/)).toHaveLength(0);

  confirmacoes.aceitar = true;
  await excluir.click();
  await expect.poll(() => api.escritasDe('DELETE', /^\/api\/absences\/2$/).length).toBe(1);
  expect(Number(api.employees[0].folga_hours)).toBe(10);
  await expect(page.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0);
});

test('excluir férias aprovadas devolve dias; falta aprovada não altera saldo', async ({ page, api }) => {
  api.employees[0].vacation_days = 20;
  api.semearAusencia({ employee_id: 1, type: 'ferias', days_count: 10, start_date: hojeIso(-20), end_date: hojeIso(-11) });
  api.semearAusencia({ employee_id: 3, type: 'falta' });
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/ferias');

  await page.getByRole('button', { name: 'Excluir', exact: true }).first().click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
  const mensagens = confirmacoes.mensagens.join('\n');
  expect(mensagens).toContain('Os 10 dias de férias voltam para Ana; saldo passa de 20 dias para 30 dias.');
  expect(mensagens).toContain('Excluir Falta de Carla Dias? Esta exclusão não altera saldo.');
});

test('editar horas de folga aprovada ajusta a diferença; acima do saldo mostra o 422 no modal', async ({ page, api }) => {
  api.employees[0].folga_hours = 6;
  const folga = api.semearAusencia({ employee_id: 1, type: 'folga', hours: 4 });
  await page.goto('/ferias');

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByText('Altere os dados da solicitação.')).toBeVisible();
  await expect(page.getByLabel('Horas', { exact: true })).toHaveValue('4');

  // Acima do saldo: o servidor recusa (422) e o erro aparece no próprio modal.
  await page.getByLabel('Horas', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByText('Saldo insuficiente: Ana Souza tem 6h disponíveis.')).toBeVisible();
  await expect(page.getByText('Altere os dados da solicitação.')).toBeVisible();
  expect(Number(api.employees[0].folga_hours)).toBe(6);

  // Dentro do saldo: PATCH com o payload exato e o banco de horas fica 6h - (5h - 4h) = 5h.
  await page.getByLabel('Horas', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect.poll(() => api.escritasDe('PATCH', new RegExp(`^/api/absences/${folga.id}$`)).length).toBe(2);
  expect(api.escritasDe('PATCH', new RegExp(`^/api/absences/${folga.id}$`))[1].corpo).toEqual({
    type: 'folga', start_date: folga.start_date, end_date: folga.end_date, hours: 5,
  });
  expect(Number(api.employees[0].folga_hours)).toBe(5);
  await expect(page.getByText('Altere os dados da solicitação.')).toBeHidden();
  await expect(page.getByText('5h').first()).toBeVisible();
});
