// Fluxo (21): editar pesquisa — sem respostas (livre), com respostas (bloqueios e só o permitido) e 409 do servidor.

import { entrarComoRh, expect, test } from './base';
import type { ApiSimulada } from './apiSimulada';

function semearClima(api: ApiSimulada, respostas = 0) {
  const s = api.semearPesquisa('Clima de outubro', 'employees', [
    { question: 'Como está o clima?', type: 'scale', required: true },
    { question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial'], required: false },
  ]);
  s.response_count = respostas;
  return s;
}

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
});

test('sem respostas a edição é livre: tipo, remover, acrescentar; PUT com ids só nas existentes', async ({ page, api }) => {
  const s = semearClima(api);
  const [q1] = s.questions ?? [];
  await page.goto(`/pesquisas/${s.id}`);
  // O botão Editar dos resultados abre o editor carregado com a pesquisa.
  await page.getByRole('button', { name: 'Editar pesquisa' }).click();
  await expect(page).toHaveURL(new RegExp(`/pesquisas/editar/${s.id}$`));
  await expect(page.getByLabel('Título da pesquisa')).toHaveValue('Clima de outubro');
  await expect(page.getByText(/já tem .* respostas?/)).toHaveCount(0);

  await page.getByLabel('Título da pesquisa').fill('Clima de novembro');
  await page.getByLabel('Pergunta 1 de 2', { exact: true }).getByRole('radio', { name: 'Aberta', exact: true }).click();
  // Excluir a pergunta 2 pede confirmação.
  page.once('dialog', (d) => { void d.accept(); });
  await page.getByRole('button', { name: 'Excluir pergunta 2' }).click();
  await page.getByRole('button', { name: 'Adicionar pergunta', exact: true }).click();
  await page.getByLabel('Texto da pergunta 2').fill('Nova pergunta?');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();

  await expect.poll(() => api.escritasDe('PUT', /^\/api\/surveys\/1$/).length).toBe(1);
  expect(api.escritasDe('PUT', /^\/api\/surveys\/1$/)[0].corpo).toEqual({
    title: 'Clima de novembro',
    expires_at: null,
    questions: [
      { id: q1.id, question: 'Como está o clima?', type: 'text', required: true },
      { question: 'Nova pergunta?', type: 'scale', required: true },
    ],
  });
  // Volta para os resultados já com o título novo.
  await expect(page).toHaveURL(new RegExp(`/pesquisas/${s.id}$`));
  await expect(page.getByRole('heading', { name: 'Clima de novembro' }).or(page.getByText('Clima de novembro').first())).toBeVisible();
});

test('com respostas: banner, o que é bloqueado fica desabilitado e só o permitido é salvo', async ({ page, api }) => {
  const s = semearClima(api, 21);
  const [q1, q2] = s.questions ?? [];
  await page.goto(`/pesquisas/editar/${s.id}`);

  await expect(page.getByText('Esta pesquisa já tem 21 respostas, por isso algumas alterações estão bloqueadas.')).toBeVisible();

  // Pergunta existente: tipo, ordem, duplicar e excluir bloqueados, com explicação.
  const p1 = page.getByLabel('Pergunta 1 de 2', { exact: true });
  await expect(p1.getByText(/já tem respostas: o tipo, a posição e as opções/)).toBeVisible();
  await expect(p1.getByRole('radio', { name: 'Aberta', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Excluir pergunta 1' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Descer pergunta 1' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Duplicar pergunta 1' })).toBeDisabled();

  // Opções que já existem ficam fixas; dá para acrescentar ao fim.
  await expect(page.getByLabel('Opção 1 da pergunta 2', { exact: true })).toBeEditable({ editable: false });
  await expect(page.getByRole('button', { name: 'Remover opção 1' })).toBeDisabled();
  // Pergunta que já era opcional não volta a ser obrigatória.
  await expect(page.getByRole('switch', { name: 'Pergunta 2 obrigatória' })).toBeDisabled();

  // Permitido: título, texto da pergunta, obrigatória de sim para não, opção nova ao fim, pergunta nova (opcional).
  await page.getByLabel('Título da pesquisa').fill('Clima de outubro (revisado)');
  await page.getByLabel('Texto da pergunta 1').fill('Como você avalia o clima?');
  await page.getByRole('switch', { name: 'Pergunta 1 obrigatória' }).uncheck();
  await page.getByRole('button', { name: 'Adicionar opção na pergunta 2' }).click();
  await page.getByLabel('Opção 3 da pergunta 2', { exact: true }).fill('Híbrido');
  await page.getByRole('button', { name: 'Adicionar pergunta', exact: true }).click();
  const p3 = page.getByLabel('Pergunta 3 de 3', { exact: true });
  await expect(p3.getByText(/nasce opcional/)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Pergunta 3 obrigatória' })).toBeDisabled();
  await p3.getByRole('radio', { name: 'Aberta', exact: true }).click();
  await page.getByLabel('Texto da pergunta 3').fill('Algo a acrescentar?');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();

  await expect.poll(() => api.escritasDe('PUT', /^\/api\/surveys\/1$/).length).toBe(1);
  expect(api.escritasDe('PUT', /^\/api\/surveys\/1$/)[0].corpo).toEqual({
    title: 'Clima de outubro (revisado)',
    expires_at: null,
    questions: [
      { id: q1.id, question: 'Como você avalia o clima?', type: 'scale', required: false },
      { id: q2.id, question: 'Onde prefere trabalhar?', type: 'choice', options: ['Remoto', 'Presencial', 'Híbrido'], required: false },
      { question: 'Algo a acrescentar?', type: 'text', required: false },
    ],
  });
  await expect(page).toHaveURL(new RegExp(`/pesquisas/${s.id}$`));
});

test('se o servidor responder 409, mostra cada bloqueio e fica no editor', async ({ page, api }) => {
  const s = semearClima(api, 3);
  api.forcarBloqueios = ['A pergunta 1 não pode mudar de tipo.', 'A pergunta 2 não pode ser removida.'];
  await page.goto(`/pesquisas/editar/${s.id}`);
  await page.getByLabel('Título da pesquisa').fill('Novo título');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();

  await expect(page.getByText('O servidor não permitiu esta alteração:')).toBeVisible();
  await expect(page.getByText('• A pergunta 1 não pode mudar de tipo.')).toBeVisible();
  await expect(page.getByText('• A pergunta 2 não pode ser removida.')).toBeVisible();
  await expect(page).toHaveURL(/\/pesquisas\/editar\/1$/);
  expect(api.escritasDe('PUT', /surveys/)).toHaveLength(1);
});

test('campanha NPS: o editor abre pela lista e a regra de respostas vale igual', async ({ page, api }) => {
  const s = api.semearPesquisa('Satisfação do cliente', 'customers', [
    { question: 'De 0 a 10, quanto recomendaria?', type: 'nps', required: true },
    { question: 'Motivo?', type: 'text', required: false },
  ]);
  s.response_count = 5;
  await page.goto('/nps');
  await page.getByRole('button', { name: 'Editar Satisfação do cliente' }).click();
  await expect(page).toHaveURL(new RegExp(`/nps/editar/${s.id}$`));
  await expect(page.getByText('Esta campanha já tem 5 respostas, por isso algumas alterações estão bloqueadas.')).toBeVisible();
  await expect(page.getByLabel('Pergunta 1 de 2', { exact: true }).getByRole('radio', { name: 'Escala 1 a 5', exact: true })).toBeDisabled();
  await page.getByLabel('Título da campanha').fill('Satisfação — novembro');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect.poll(() => api.escritasDe('PUT', /^\/api\/surveys\/1$/).length).toBe(1);
  await expect(page).toHaveURL(new RegExp(`/nps/${s.id}$`));
});
