// Fluxo (13): Feedback PÚBLICO /feedback/[token] (sem login) — ciência com e sem observação,
// reabrir link confirmado (somente leitura), token revogado e inválido.

import { expect, test } from './base';

const TOKEN_DESCONHECIDO = 'z'.repeat(43);

test('marcar ciência COM observação envia {acknowledged:true, note} e mostra a nota', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Entrega do relatório', content: 'Parabéns pela clareza.', status: 'published' });
  await page.goto(`/feedback/${f.public_token}`);
  await expect(page.getByRole('heading', { name: 'Entrega do relatório' })).toBeVisible();
  await expect(page.getByText('Para Ana Souza')).toBeVisible();

  // Confirmar é bloqueado até marcar "Li e estou ciente".
  const confirmar = page.getByRole('button', { name: /Confirmar leitura/ });
  await expect(confirmar).toBeDisabled();
  await page.getByRole('checkbox', { name: /Li e estou ciente/ }).click();
  await expect(confirmar).toBeEnabled();
  await page.getByLabel('Observação opcional').fill('  Obrigada pelo retorno!  ');
  await confirmar.click();

  await expect.poll(() => api.escritasDe('POST', /acknowledge$/).length).toBe(1);
  expect(api.escritasDe('POST', /acknowledge$/)[0].corpo).toEqual({ acknowledged: true, note: 'Obrigada pelo retorno!' });
  await expect(page.getByText('Leitura confirmada').first()).toBeVisible();
  await expect(page.getByText('Obrigada pelo retorno!')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('marcar ciência SEM observação envia só {acknowledged:true}', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Conversa rápida', content: 'Texto do feedback.', status: 'published' });
  await page.goto(`/feedback/${f.public_token}`);
  await page.getByRole('checkbox', { name: /Li e estou ciente/ }).click();
  // Só espaços não contam como observação.
  await page.getByLabel('Observação opcional').fill('   ');
  await page.getByRole('button', { name: /Confirmar leitura/ }).click();

  await expect.poll(() => api.escritasDe('POST', /acknowledge$/).length).toBe(1);
  const corpo = api.escritasDe('POST', /acknowledge$/)[0].corpo;
  expect(corpo).toEqual({ acknowledged: true });
  expect(corpo).not.toHaveProperty('note');
  await expect(page.getByText('Leitura confirmada').first()).toBeVisible();
});

test('reabrir um link já confirmado mostra a data e a nota SOMENTE LEITURA', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Feedback antigo', content: 'Conteúdo.', status: 'acknowledged', note: 'Entendi e vou aplicar.' });
  await page.goto(`/feedback/${f.public_token}`);

  await expect(page.getByText('Leitura confirmada').first()).toBeVisible();
  await expect(page.getByText(/Você confirmou em .* e escreveu:/)).toBeVisible();
  await expect(page.getByText('Entendi e vou aplicar.')).toBeVisible();
  // Nada para editar: sem checkbox, sem campo de observação, sem botão de confirmar.
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByLabel('Observação opcional')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Confirmar leitura/ })).toHaveCount(0);
  expect(api.escritasDe('POST', /acknowledge$/)).toHaveLength(0);
});

test('link confirmado SEM nota não fala em "escreveu"', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Feedback sem nota', content: 'Conteúdo.', status: 'acknowledged' });
  await page.goto(`/feedback/${f.public_token}`);
  await expect(page.getByText(/Você confirmou em .*\.$/)).toBeVisible();
  await expect(page.getByText(/e escreveu/)).toHaveCount(0);
});

test('token revogado mostra a mensagem de link revogado', async ({ page, api }) => {
  const f = api.semearFeedback({ employee_id: 1, title: 'Feedback revogado', content: 'Conteúdo.', status: 'revoked' });
  await page.goto(`/feedback/${f.public_token}`);
  await expect(page.getByText('Feedback indisponível')).toBeVisible();
  await expect(page.getByText('Este link de feedback foi revogado')).toBeVisible();
  await expect(page.getByText('Conteúdo.')).toHaveCount(0);
});

test('token inexistente mostra "Feedback não encontrado" e token malformado mostra "Link inválido"', async ({ page }) => {
  await page.goto(`/feedback/${TOKEN_DESCONHECIDO}`);
  await expect(page.getByText('Feedback indisponível')).toBeVisible();
  await expect(page.getByText('Feedback não encontrado')).toBeVisible();

  await page.goto('/feedback/curto');
  await expect(page.getByText('Link inválido')).toBeVisible();
});
