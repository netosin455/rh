// Fluxo (12): Feedbacks do RH — rascunho, publicar (link com token), copiar link, revogar com confirmação.

import { entrarComoRh, expect, test } from './base';
import { ORIGEM } from './apiSimulada';

test('rascunho -> publicar -> copiar link -> revogar (com confirmação)', async ({ page, context, api }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGEM });
  await entrarComoRh(page);
  await page.goto('/feedbacks');
  await page.getByRole('button', { name: /Novo feedback/ }).first().click();
  await expect(page).toHaveURL(/\/feedbacks\/novo$/);

  // Sem colaborador/título/texto, nada é enviado.
  await page.getByRole('button', { name: /Salvar rascunho/ }).click();
  await expect(page.getByText('Preencha colaborador, título e texto do feedback.')).toBeVisible();
  expect(api.escritasDe('POST', /feedbacks/)).toHaveLength(0);

  await page.getByRole('radio', { name: /Ana Souza/ }).click();
  await page.getByLabel('Título', { exact: true }).fill('Entrega do relatório');
  await page.getByLabel('Texto do feedback').fill('Parabéns pela clareza do relatório mensal.');
  await page.getByRole('button', { name: /Salvar rascunho/ }).click();

  await expect.poll(() => api.escritasDe('POST', /^\/api\/feedbacks$/).length).toBe(1);
  expect(api.escritasDe('POST', /^\/api\/feedbacks$/)[0].corpo).toEqual({
    employee_id: 1, title: 'Entrega do relatório', content: 'Parabéns pela clareza do relatório mensal.',
  });
  await expect(page).toHaveURL(/\/feedbacks\/1$/);
  await expect(page.getByText('Revisar rascunho')).toBeVisible();

  // Publicar pede confirmação.
  page.once('dialog', (d) => { void d.accept(); });
  await page.getByRole('button', { name: /Publicar feedback/ }).click();
  await expect.poll(() => api.escritasDe('POST', /^\/api\/feedbacks\/1\/publish$/).length).toBe(1);

  const token = api.feedbacks[0].public_token ?? '';
  expect(token).toHaveLength(43);
  const link = `${ORIGEM}/feedback/${token}`;
  await expect(page.getByText(link)).toBeVisible();
  // A lista (mais abaixo na pilha) também se atualiza para "Aguardando leitura": basta a tela aberta mostrar o status.
  await expect(page.getByText('Aguardando leitura').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Copiar link/ }).click();
  await expect(page.getByText('Link copiado.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

  // Revogar: cancelar na confirmação não revoga; confirmar revoga.
  await page.getByRole('button', { name: /Mais ações/ }).click();
  page.once('dialog', (d) => { void d.dismiss(); });
  await page.getByRole('button', { name: 'Revogar acesso' }).click();
  expect(api.escritasDe('POST', /revoke/)).toHaveLength(0);

  page.once('dialog', (d) => { void d.accept(); });
  await page.getByRole('button', { name: 'Revogar acesso' }).click();
  await expect.poll(() => api.escritasDe('POST', /^\/api\/feedbacks\/1\/revoke$/).length).toBe(1);
  await expect(page.getByText('Acesso revogado').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(link)).toHaveCount(0);
});

// Regressão do bug achado nesta rodada: as buscas do formulário e da lista de feedbacks diferenciavam acento
// ("brúno" não achava "Bruno"). Agora as duas usam normalizarTexto, como o seletor do Lançar.
test('buscas do formulário e da lista de feedbacks ignoram acento e maiúsculas', async ({ page, api }) => {
  api.semearFeedback({ employee_id: 3, title: 'Conversa de acompanhamento', content: 'Texto.', status: 'published' });
  await entrarComoRh(page);
  await page.goto('/feedbacks/novo');
  await page.getByLabel('Buscar colaborador').fill('BRÚNO');
  await expect(page.getByRole('radio', { name: /Bruno Lima/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Ana Souza/ })).toHaveCount(0);

  await page.goto('/feedbacks');
  await page.getByLabel('Buscar colaborador').fill('cárla');
  await expect(page.getByText('Conversa de acompanhamento')).toBeVisible();
  await page.getByLabel('Buscar colaborador').fill('zzz');
  await expect(page.getByText('Nenhum feedback encontrado para este filtro.')).toBeVisible();
});
