// Fluxo (23): excluir feedback — rascunho (aviso simples) e publicado/confirmado (link e observação perdidos).

import { controlarConfirmacoes, entrarComoRh, expect, test } from './base';

test.beforeEach(async ({ page }) => {
  await entrarComoRh(page);
});

test('rascunho: Excluir rascunho com aviso simples; cancelar não apaga; confirmar volta à lista', async ({ page, api }) => {
  api.semearFeedback({ employee_id: 1, title: 'Rascunho de teste', content: 'Texto.', status: 'draft' });
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/feedbacks/1');

  await page.getByRole('button', { name: 'Excluir rascunho' }).click();
  expect(confirmacoes.mensagens[0]).toBe('Excluir rascunho\n\nExcluir este rascunho? Não dá para desfazer.');
  expect(api.escritasDe('DELETE', /feedbacks/)).toHaveLength(0);

  confirmacoes.aceitar = true;
  await page.getByRole('button', { name: 'Excluir rascunho' }).click();
  await expect.poll(() => api.escritasDe('DELETE', /^\/api\/feedbacks\/1$/).length).toBe(1);
  await expect(page).toHaveURL(/\/feedbacks$/);
  await expect(page.getByText('Nenhum feedback criado')).toBeVisible();
});

test('publicado: Mais ações > Excluir feedback avisa que o link para de funcionar', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Feedback publicado', content: 'Texto.', status: 'published' });
  const confirmacoes = controlarConfirmacoes(page);
  await page.goto('/feedbacks/1');

  await page.getByRole('button', { name: /Mais ações/ }).click();
  await page.getByRole('button', { name: 'Excluir feedback' }).click();
  expect(confirmacoes.mensagens[0]).toBe('Excluir feedback\n\nO link deixa de funcionar e a data e a observação do colaborador serão perdidas. Não dá para desfazer.');
  expect(api.escritasDe('DELETE', /feedbacks/)).toHaveLength(0);

  confirmacoes.aceitar = true;
  await page.getByRole('button', { name: 'Excluir feedback' }).click();
  await expect.poll(() => api.escritasDe('DELETE', /^\/api\/feedbacks\/1$/).length).toBe(1);
  await expect(page).toHaveURL(/\/feedbacks$/);

  // O link público do feedback excluído deixa de abrir.
  await page.goto(`/feedback/${f.public_token}`);
  await expect(page.getByText('Feedback não encontrado')).toBeVisible();
});

test('confirmado (com observação) usa o mesmo aviso; revogado só oferece Excluir', async ({ page, api }) => {
  api.semearFeedback({ employee_id: 1, title: 'Confirmado', content: 'Texto.', status: 'acknowledged', note: 'Entendi.' });
  api.semearFeedback({ employee_id: 2, title: 'Revogado', content: 'Texto.', status: 'revoked' });
  const confirmacoes = controlarConfirmacoes(page);

  // semearFeedback insere no início: id 1 = Confirmado, id 2 = Revogado (ids sequenciais).
  await page.goto('/feedbacks/1');
  await page.getByRole('button', { name: /Mais ações/ }).click();
  await page.getByRole('button', { name: 'Excluir feedback' }).click();
  expect(confirmacoes.mensagens[0]).toContain('O link deixa de funcionar');
  expect(confirmacoes.mensagens[0]).toContain('observação do colaborador serão perdidas');

  await page.goto('/feedbacks/2');
  await page.getByRole('button', { name: /Mais ações/ }).click();
  await expect(page.getByRole('button', { name: 'Revogar acesso' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Excluir feedback' }).click();
  expect(confirmacoes.mensagens[1]).not.toContain('link deixa de funcionar');
});
